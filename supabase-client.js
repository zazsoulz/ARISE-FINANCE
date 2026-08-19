(function(root){
  "use strict";

  let client=null;
  let session=null;

  function config(){return root.ARISE_SUPABASE_CONFIG||{};}

  function available(){
    return !!(root.supabase&&typeof root.supabase.createClient==="function"&&config().url&&config().publishableKey);
  }

  function getClient(){
    if(client) return client;
    if(!available()) return null;
    client=root.supabase.createClient(config().url,config().publishableKey,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }

  async function init(){
    const supabase=getClient();
    if(!supabase) return {available:false,session:null};
    const {data,error}=await supabase.auth.getSession();
    if(error) throw error;
    session=data.session||null;
    return {available:true,session};
  }

  async function signUp({name,email,password}){
    const supabase=getClient();
    if(!supabase) throw new Error("Сервис авторизации сейчас недоступен.");
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{name}}});
    if(error) throw error;
    session=data.session||null;
    return data;
  }

  async function signIn({email,password}){
    const supabase=getClient();
    if(!supabase) throw new Error("Сервис авторизации сейчас недоступен.");
    const {data,error}=await supabase.auth.signInWithPassword({email,password});
    if(error) throw error;
    session=data.session||null;
    return data;
  }

  async function signOut(){
    const supabase=getClient();
    if(!supabase) return;
    const {error}=await supabase.auth.signOut();
    if(error) throw error;
    session=null;
  }

  async function resetPassword(email){
    const supabase=getClient();
    if(!supabase) throw new Error("Сервис авторизации сейчас недоступен.");
    const redirectTo=location.origin+location.pathname;
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
    if(error) throw error;
  }

  async function updatePassword(password){
    const supabase=getClient();
    if(!supabase) throw new Error("Сервис авторизации сейчас недоступен.");
    const {data,error}=await supabase.auth.updateUser({password});
    if(error) throw error;
    return data;
  }

  async function loadAccount(){
    const supabase=getClient();
    const user=session&&session.user;
    if(!supabase||!user) return null;
    const {data,error}=await supabase.from("accounts").select("user_id,name,avatar_url,notifications_enabled").eq("user_id",user.id).maybeSingle();
    if(error) throw error;
    return data;
  }

  async function updateAccount(patch){
    const supabase=getClient();
    const user=(await supabase.auth.getUser()).data.user;
    if(!user) throw new Error("Нужно войти в аккаунт.");
    const row={user_id:user.id,...patch};
    const {data,error}=await supabase.from("accounts").upsert(row,{onConflict:"user_id"}).select().single();
    if(error) throw error;
    return data;
  }

  async function listFinanceProfiles(){
    const supabase=getClient();
    if(!supabase) return [];
    const {data,error}=await supabase.from("finance_profiles").select("id,user_id,name,base_currency,settings,created_at,updated_at").is("archived_at",null).order("created_at");
    if(error) throw error;
    return data||[];
  }

  function currentSession(){return session;}

  root.ARISE_SUPABASE={available,getClient,init,signUp,signIn,signOut,resetPassword,updatePassword,loadAccount,updateAccount,listFinanceProfiles,currentSession};
})(typeof globalThis!=="undefined"?globalThis:window);
