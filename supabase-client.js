(function(root){
  "use strict";

  let client=null;
  let session=null;
  const AVATAR_BUCKET="arise-avatars";

  function config(){return root.ARISE_SUPABASE_CONFIG||{};}
  function available(){return !!(root.supabase&&typeof root.supabase.createClient==="function"&&config().url&&config().publishableKey);}

  function getClient(){
    if(client) return client;
    if(!available()) return null;
    client=root.supabase.createClient(config().url,config().publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
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

  async function resolveAvatar(value){
    if(!value||!String(value).startsWith("storage:")) return value||"";
    const path=String(value).slice("storage:".length);
    const supabase=getClient();
    if(!supabase) return "";
    const {data,error}=await supabase.storage.from(AVATAR_BUCKET).createSignedUrl(path,3600);
    if(error){console.error("ARISE avatar signed url",error);return "";}
    return data.signedUrl||"";
  }

  async function loadAccount(){
    const supabase=getClient();
    const user=session&&session.user;
    if(!supabase||!user) return null;
    const {data,error}=await supabase.from("accounts").select("user_id,name,avatar_url,notifications_enabled").eq("user_id",user.id).maybeSingle();
    if(error) throw error;
    if(!data) return null;
    return {...data,avatar_display_url:await resolveAvatar(data.avatar_url)};
  }

  async function updateAccount(patch){
    const supabase=getClient();
    if(!supabase) throw new Error("Сервис авторизации сейчас недоступен.");
    const {data:userData,error:userError}=await supabase.auth.getUser();
    if(userError) throw userError;
    const user=userData.user;
    if(!user) throw new Error("Нужно войти в аккаунт.");
    const row={user_id:user.id,...patch};
    const {data,error}=await supabase.from("accounts").upsert(row,{onConflict:"user_id"}).select().single();
    if(error) throw error;
    return {...data,avatar_display_url:await resolveAvatar(data.avatar_url)};
  }

  async function uploadAvatar(file){
    const supabase=getClient();
    if(!supabase) throw new Error("Сервис авторизации сейчас недоступен.");
    if(!file||!file.type||!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Выбери JPG, PNG или WEBP изображение.");
    if(file.size>5*1024*1024) throw new Error("Фото должно быть меньше 5 МБ.");
    const {data:userData,error:userError}=await supabase.auth.getUser();
    if(userError) throw userError;
    const user=userData.user;
    if(!user) throw new Error("Нужно войти в аккаунт.");
    const ext=file.type==="image/jpeg"?"jpg":file.type.split("/")[1];
    const path=`${user.id}/avatar.${ext}`;
    const {error}=await supabase.storage.from(AVATAR_BUCKET).upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
    if(error) throw error;
    const account=await updateAccount({avatar_url:`storage:${path}`});
    return account.avatar_display_url||"";
  }

  async function listFinanceProfiles(){
    const supabase=getClient();
    if(!supabase) return [];
    const {data,error}=await supabase.from("finance_profiles").select("id,user_id,name,base_currency,settings,created_at,updated_at").is("archived_at",null).order("created_at");
    if(error) throw error;
    return data||[];
  }

  function currentSession(){return session;}

  root.ARISE_SUPABASE={available,getClient,init,signUp,signIn,signOut,resetPassword,updatePassword,loadAccount,updateAccount,uploadAvatar,resolveAvatar,listFinanceProfiles,currentSession};
})(typeof globalThis!=="undefined"?globalThis:window);
