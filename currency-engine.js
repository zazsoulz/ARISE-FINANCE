(function(root,factory){
  const api=factory(root);
  if(typeof module!=="undefined"&&module.exports) module.exports=api;
  if(root) root.ARISE_CURRENCY=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(root){
  "use strict";

  const CURRENCIES=Object.freeze(["RUB","EUR","USD"]);
  const SYMBOLS=Object.freeze({RUB:"₽",EUR:"€",USD:"$"});
  const CACHE_KEY="arise.finance.fx.v1";
  const MAX_CACHE_AGE_MS=24*60*60*1000;

  const finite=value=>Number.isFinite(Number(value));
  const amount=value=>finite(value)?Math.max(0,Number(value)):0;

  function normalizeCurrency(value,fallback="RUB"){
    const code=String(value||"").trim().toUpperCase();
    return CURRENCIES.includes(code)?code:(CURRENCIES.includes(fallback)?fallback:"RUB");
  }

  function validRateBook(book){
    if(!book||normalizeCurrency(book.base,"USD")!=="USD"||!book.rates) return false;
    return CURRENCIES.every(code=>finite(book.rates[code])&&Number(book.rates[code])>0);
  }

  function sanitizeRateBook(book){
    if(!validRateBook(book)) return null;
    return {
      base:"USD",
      rates:{USD:1,EUR:Number(book.rates.EUR),RUB:Number(book.rates.RUB)},
      fetchedAt:book.fetchedAt||new Date().toISOString(),
      source:String(book.source||"unknown")
    };
  }

  function cacheStorage(){
    try{return root&&root.localStorage||null;}catch(_){return null;}
  }

  function loadCached(){
    const storage=cacheStorage();
    if(!storage) return null;
    try{return sanitizeRateBook(JSON.parse(storage.getItem(CACHE_KEY)||"null"));}
    catch(error){console.error("ARISE FX cache read",error);return null;}
  }

  function saveCached(book){
    const normalized=sanitizeRateBook(book);
    if(!normalized) throw new Error("Некорректные данные курса валют.");
    const storage=cacheStorage();
    if(storage) storage.setItem(CACHE_KEY,JSON.stringify(normalized));
    return normalized;
  }

  function ageMs(book,now=Date.now()){
    const timestamp=new Date(book&&book.fetchedAt||0).getTime();
    return Number.isFinite(timestamp)?Math.max(0,now-timestamp):Infinity;
  }

  function isFresh(book,maxAgeMs=MAX_CACHE_AGE_MS){return !!sanitizeRateBook(book)&&ageMs(book)<=maxAgeMs;}

  function rateBookStatus(book,{now=Date.now(),maxAgeMs=MAX_CACHE_AGE_MS}={}){
    const normalized=sanitizeRateBook(book);
    if(!normalized){
      return {available:false,fresh:false,stale:false,ageMs:Infinity,fetchedAt:null,source:null};
    }
    const age=ageMs(normalized,now);
    const fresh=age<=maxAgeMs;
    return {
      available:true,
      fresh,
      stale:!fresh,
      ageMs:age,
      fetchedAt:normalized.fetchedAt,
      source:normalized.source
    };
  }

  function rate(book,from,to){
    const normalized=sanitizeRateBook(book);
    const source=normalizeCurrency(from);
    const target=normalizeCurrency(to);
    if(source===target) return 1;
    if(!normalized) return null;
    const sourcePerUsd=Number(normalized.rates[source]);
    const targetPerUsd=Number(normalized.rates[target]);
    if(!finite(sourcePerUsd)||sourcePerUsd<=0||!finite(targetPerUsd)||targetPerUsd<=0) return null;
    return targetPerUsd/sourcePerUsd;
  }

  function convert(value,from,to,book,{round=true}={}){
    const original=amount(value);
    const multiplier=rate(book,from,to);
    if(multiplier===null) return null;
    const result=original*multiplier;
    return round?Math.round(result):result;
  }

  function snapshot(value,from,baseCurrency,book){
    const originalAmount=amount(value);
    const originalCurrency=normalizeCurrency(from,baseCurrency);
    const base=normalizeCurrency(baseCurrency);
    const multiplier=originalCurrency===base?1:rate(book,originalCurrency,base);
    if(multiplier===null){
      return {
        originalAmount,originalCurrency,baseCurrency:base,
        exchangeRateToBase:null,baseAmount:null,
        fxSource:null,fxFetchedAt:null,conversionPending:true
      };
    }
    return {
      originalAmount,
      originalCurrency,
      baseCurrency:base,
      exchangeRateToBase:multiplier,
      baseAmount:Math.round(originalAmount*multiplier),
      fxSource:originalCurrency===base?"identity":String(book&&book.source||"cached"),
      fxFetchedAt:originalCurrency===base?new Date().toISOString():(book&&book.fetchedAt||new Date().toISOString()),
      conversionPending:false
    };
  }

  function transactionBaseAmount(tx,profileBase,book,{preferCurrentRate=false}={}){
    const base=normalizeCurrency(profileBase);
    const originalCurrency=normalizeCurrency(tx&&tx.originalCurrency||tx&&tx.currency,base);
    const originalAmount=amount(tx&&tx.originalAmount!=null?tx.originalAmount:tx&&tx.amount);

    if(preferCurrentRate){
      const current=convert(originalAmount,originalCurrency,base,book);
      if(current!==null) return {amount:current,pending:false,source:"current"};
    }

    if(tx&&normalizeCurrency(tx.baseCurrency||tx.base_currency,base)===base&&finite(tx.baseAmount??tx.base_amount)){
      return {amount:Math.max(0,Number(tx.baseAmount??tx.base_amount)),pending:false,source:"snapshot"};
    }

    if(originalCurrency===base) return {amount:originalAmount,pending:false,source:"identity"};
    const cached=convert(originalAmount,originalCurrency,base,book);
    if(cached!==null) return {amount:cached,pending:false,source:"cached"};
    return {amount:0,pending:true,source:"missing_rate"};
  }

  async function fetchLatest(){
    const supabase=root&&root.ARISE_SUPABASE;
    const client=supabase&&supabase.getClient?supabase.getClient():null;
    if(!client||!client.functions||typeof client.functions.invoke!=="function"){
      throw new Error("Сервис курса валют сейчас недоступен.");
    }
    const {data,error}=await client.functions.invoke("fx-rates",{method:"POST"});
    if(error) throw error;
    return saveCached(data);
  }

  async function ensureRateBook({maxAgeMs=MAX_CACHE_AGE_MS,force=false}={}){
    const cached=loadCached();
    if(!force&&isFresh(cached,maxAgeMs)) return {book:cached,source:"cache",fresh:true};
    if(root&&root.navigator&&root.navigator.onLine===false){
      if(cached) return {book:cached,source:"stale_cache",fresh:false};
      return {book:null,source:"offline",fresh:false};
    }
    try{
      const latest=await fetchLatest();
      return {book:latest,source:"network",fresh:true};
    }catch(error){
      console.error("ARISE FX refresh",error);
      if(cached) return {book:cached,source:"stale_cache",fresh:false,error};
      return {book:null,source:"unavailable",fresh:false,error};
    }
  }

  function format(value,currency,locale="ru-RU"){
    const code=normalizeCurrency(currency);
    try{return new Intl.NumberFormat(locale,{style:"currency",currency:code,maximumFractionDigits:0}).format(amount(value));}
    catch(_){return `${Math.round(amount(value)).toLocaleString(locale)} ${SYMBOLS[code]}`;}
  }

  return {
    CURRENCIES,SYMBOLS,CACHE_KEY,MAX_CACHE_AGE_MS,
    normalizeCurrency,validRateBook,sanitizeRateBook,loadCached,saveCached,ageMs,isFresh,rateBookStatus,
    rate,convert,snapshot,transactionBaseAmount,fetchLatest,ensureRateBook,format
  };
});