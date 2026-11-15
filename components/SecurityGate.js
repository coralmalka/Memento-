import React, {useEffect,useState} from 'react';
import {ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

const PINK='#E4384F';
const numberOk = value=>/^\+[1-9]\d{7,14}$/.test((value||'').replace(/[\s()-]/g,''));

export default function SecurityGate({supabase,user,mode,onVerified}) {
  const phoneFromSignup=user?.user_metadata?.memento_phone_pending || '';
  const [phone,setPhone]=useState(phoneFromSignup);
  const [factor,setFactor]=useState(null);
  const [challenge,setChallenge]=useState(null);
  const [code,setCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [sent,setSent]=useState(false);
  const verifiedMode=mode==='challenge';

  useEffect(()=>{
    let active=true;
    setFactor(null);setChallenge(null);setCode('');setSent(false);setError('');
    if(verifiedMode){
      supabase.auth.mfa.listFactors().then(({data,error:err})=>{
        if(!active)return;
        if(err){setError(err.message);return;}
        const selected=(data?.phone||[]).find(f=>f.status==='verified')
          ||(data?.totp||[]).find(f=>f.status==='verified');
        if(!selected){setError('No verified security method was found. Contact Memento support.');return;}
        setFactor(selected);
      }).catch(e=>{if(active)setError(e.message||String(e));});
    }
    return ()=>{active=false;};
  },[verifiedMode,user?.id,supabase]);

  async function sendCode(){
    if(busy)return;
    const dest=phone.replace(/[\s()-]/g,'');
    if(!verifiedMode && !numberOk(dest))return setError('Enter a valid phone number with country code, like +12125550123.');
    setBusy(true);setError('');
    try{
      let f=factor;
      if(!verifiedMode){
        const result=await supabase.auth.mfa.enroll({factorType:'phone',friendlyName:'Memento phone',phone:dest});
        if(result.error)throw result.error;
        f=result.data;setFactor(f);
      }
      if(!f?.id)throw Error('Could not start phone verification.');
      const response=await supabase.auth.mfa.challenge({factorId:f.id});
      if(response.error)throw response.error;
      setChallenge(response.data);
      setSent(true);
    }catch(e){
      setError(e.message||String(e));
    }finally{setBusy(false);}
  }

  async function verifyCode(){
    if(!factor?.id||!challenge?.id||!code.trim()||busy)return;
    setBusy(true);setError('');
    try{
      const {error:err}=await supabase.auth.mfa.verify({factorId:factor.id,challengeId:challenge.id,code:code.trim()});
      if(err)throw err;
      // Only the Supabase server may promote a session to aal2.
      const {data, error:aalError}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if(aalError)throw aalError;
      if(data?.currentLevel!=='aal2')throw Error('Verification did not complete. Try again.');
      onVerified();
    }catch(e){setError(e.message||String(e));}
    finally{setBusy(false);}
  }

  return <SafeAreaView style={styles.safe}><View style={styles.page}>
    <View style={styles.shield}><Ionicons name="shield-checkmark-outline" color="#fff" size={33}/></View>
    <Text style={styles.kicker}>MEMENTO / ACCOUNT SECURITY</Text>
    <Text style={styles.title}>{verifiedMode?'Verify it’s you.':'Protect your account.'}</Text>
    <Text style={styles.description}>{verifiedMode
      ? 'Enter the security code to finish signing in. Your password alone is not enough.'
      : 'New accounts require a verified phone security factor before entering Memento.'}</Text>
    {verifiedMode && factor?.factor_type==='totp' && <Text style={styles.helper}>Open your authenticator app for your six-digit code.</Text>}
    {!verifiedMode && <><Text style={styles.label}>Phone number · country code required</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone}
        placeholder="+1 212 555 0123" placeholderTextColor="#787E88" keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false}/></>}
    {!sent && <TouchableOpacity style={styles.primary} onPress={sendCode} disabled={busy || (verifiedMode&&!factor)}>
      {busy?<ActivityIndicator color="#fff"/>:<Ionicons name={verifiedMode && factor?.factor_type==='totp'?'key-outline':'chatbubble-ellipses-outline'} color="#fff" size={19}/>}
      <Text style={styles.primaryLabel}>{busy?'Please wait…':factor?.factor_type==='totp'?'Continue verification':'Send verification code'}</Text>
    </TouchableOpacity>}
    {sent && <>
      <Text style={styles.label}>Security code</Text>
      <TextInput value={code} onChangeText={setCode} style={styles.input} keyboardType="number-pad" autoComplete="one-time-code"
        textContentType="oneTimeCode" maxLength={8} placeholder="Enter code" placeholderTextColor="#787E88"/>
      <TouchableOpacity style={styles.primary} onPress={verifyCode} disabled={busy || code.trim().length<6}>
        {busy?<ActivityIndicator color="#fff"/>:<Ionicons name="lock-closed-outline" color="#fff" size={19}/>}
        <Text style={styles.primaryLabel}>{busy?'Verifying…':'Verify & enter Memento'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.secondary} onPress={sendCode} disabled={busy}>
        <Text style={styles.secondaryLabel}>Send another code</Text>
      </TouchableOpacity>
    </>}
    {!!error && <Text style={styles.error}>{error}</Text>}
    <Text style={styles.help}>SMS codes require phone MFA to be enabled with an SMS provider in Supabase. Never share a security code with anyone.</Text>
    <TouchableOpacity style={styles.signout} onPress={()=>supabase.auth.signOut()}><Text style={styles.signoutText}>Use a different account / Sign out</Text></TouchableOpacity>
  </View></SafeAreaView>;
}
const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F4F5F8'},
  page:{flex:1,paddingHorizontal:26,justifyContent:'center'},
  shield:{width:66,height:66,borderRadius:20,backgroundColor:'#212631',alignItems:'center',justifyContent:'center',marginBottom:23},
  kicker:{fontSize:11,color:PINK,fontWeight:'900',letterSpacing:1.4},
  title:{fontSize:33,color:'#161B24',fontWeight:'900',letterSpacing:-1.2,marginTop:7},
  description:{fontSize:14,color:'#4C5666',fontWeight:'650',lineHeight:22,marginTop:11,marginBottom:23},
  label:{fontSize:13,fontWeight:'850',color:'#222835',marginBottom:9},
  helper:{fontSize:13,color:'#4C5666',marginBottom:12,fontWeight:'700'},
  input:{borderWidth:1.5,borderColor:'#CED3DC',borderRadius:13,backgroundColor:'#fff',padding:16,fontWeight:'700',fontSize:16,color:'#151924',marginBottom:15},
  primary:{borderRadius:14,backgroundColor:PINK,padding:17,flexDirection:'row',gap:9,justifyContent:'center',alignItems:'center',marginBottom:10},
  primaryLabel:{fontSize:14,color:'#fff',fontWeight:'900'},
  secondary:{alignItems:'center',paddingVertical:15},
  secondaryLabel:{color:'#242B36',fontWeight:'800',fontSize:13},
  error:{backgroundColor:'#FFF0F2',color:'#A82336',fontSize:13,fontWeight:'750',borderRadius:12,padding:14,marginTop:8},
  help:{color:'#535E6B',fontSize:12,fontWeight:'650',lineHeight:19,marginTop:14},
  signout:{alignItems:'center',paddingVertical:17,marginTop:15},
  signoutText:{fontSize:13,color:'#303746',fontWeight:'850'}
});
