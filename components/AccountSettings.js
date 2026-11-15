import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Share, Switch, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DEFAULTS = {story_replies:'everyone',message_requests:'everyone',allow_story_reshares:true,hide_like_counts:false};
const ROSE = '#E4384F';
const choices = [{value:'everyone',title:'Everyone'}, {value:'following',title:'Following'}, {value:'off',title:'Off'}];

function Header({number,title,description}) {
  return <View style={styles.header}><Text style={styles.counter}>{number}</Text><View style={{flex:1}}><Text style={styles.headerTitle}>{title}</Text><Text style={styles.headerHelp}>{description}</Text></View></View>;
}
function Preference({title,description,value,onChange}) {
  return <View style={styles.option}><View style={{flex:1,paddingRight:13}}><Text style={styles.optionTitle}>{title}</Text><Text style={styles.optionHelp}>{description}</Text></View><Switch value={!!value} onValueChange={onChange} trackColor={{false:'#D5D8DF',true:'#F3AFBC'}} thumbColor={value?ROSE:'#FFFFFF'}/></View>;
}
function SelectPreference({title,description,value,onChange}) {
  return <View style={styles.optionVertical}><Text style={styles.optionTitle}>{title}</Text><Text style={styles.optionHelp}>{description}</Text><View style={styles.selectRow}>{choices.map(item=><TouchableOpacity accessibilityRole="button" key={item.value} onPress={()=>onChange(item.value)} style={[styles.select, value===item.value && styles.selected]}><Text style={[styles.selectText,value===item.value && styles.selectedText]}>{item.title}</Text></TouchableOpacity>)}</View></View>;
}
function Action({icon,title,detail,onPress,danger=false}) {
  return <TouchableOpacity onPress={onPress} accessibilityRole="button" style={styles.action}>
    <View style={[styles.actionIcon,danger && {backgroundColor:'#FFE4E9'}]}><Ionicons name={icon} size={21} color={danger?ROSE:'#232835'}/></View>
    <View style={{flex:1}}><Text style={[styles.actionTitle,danger&&{color:ROSE}]}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={18} color="#515B6C"/>
  </TouchableOpacity>;
}
export default function AccountSettings({user,supabase,settings,onSaved,onActivity,onInsights,onNotifications,notificationError,onRefresh,onBack}) {
  const [saving,setSaving]=useState(false);
  const current = {...DEFAULTS,...settings};
  async function change(key,value) {
    if(saving || current[key]===value)return;
    setSaving(true);
    try {
      const values={...DEFAULTS,...settings,[key]:value,user_id:user.id,updated_at:new Date().toISOString()};
      const {data,error}=await supabase.from('account_settings').upsert(values,{onConflict:'user_id'}).select('*').single();
      if(error)throw error;
      onSaved(data);
    }catch(e){Alert.alert('Could not save setting','Make sure the Memento sharing/settings SQL migration has been run in Supabase.\n\n'+(e?.message||String(e)));}
    finally{setSaving(false);}
  }
  async function passwordEmail(){
    if(!user.email)return Alert.alert('Account email missing','Add a recovery email to your account first.');
    Alert.alert('Reset your password?','Memento will email a secure password-reset link to '+user.email+'.',[
      {text:'Cancel',style:'cancel'},
      {text:'Send link',onPress:async()=>{
        const {error}=await supabase.auth.resetPasswordForEmail(user.email);
        if(error)Alert.alert('Password reset',error.message);
        else Alert.alert('Check your inbox','If the email is eligible, a password reset link will arrive shortly.');
      }}
    ]);
  }
  async function exportData(){
    try{
      const [posts,stories,messages]=await Promise.all([
        supabase.from('posts').select('id,caption,created_at').eq('author_id',user.id).order('created_at',{ascending:false}),
        supabase.from('stories').select('id,caption,created_at').eq('author_id',user.id).order('created_at',{ascending:false}),
        supabase.from('direct_messages').select('id,body,sender_id,recipient_id,created_at').or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`).order('created_at',{ascending:false})
      ]);
      const issue=[posts,stories,messages].find(x=>x.error)?.error;if(issue)throw issue;
      await Share.share({title:'Memento account data',message:JSON.stringify({
        exported_at:new Date().toISOString(),email:user.email,
        profile:settings?.profile_summary || null,
        posts:posts.data,stories:stories.data,messages:messages.data
      },null,2)});
    }catch(e){Alert.alert('Export failed',e.message||String(e));}
  }
  async function signOut(){
    const {error}=await supabase.auth.signOut();
    if(error)Alert.alert('Sign out failed',error.message);
  }
  return <View style={styles.page}>
    <TouchableOpacity style={styles.back} onPress={onBack}><Ionicons name="arrow-back" size={19} color="#1E2531"/><Text style={styles.backText}>Back to Memento</Text></TouchableOpacity>
    <View style={styles.hero}><View style={styles.heroBadge}><Ionicons name="settings-outline" color="#fff" size={29}/></View>
      <Text style={styles.kicker}>MEMENTO / YOUR ACCOUNT</Text>
      <Text style={styles.heroTitle}>You’re in control.</Text>
      <Text style={styles.heroText}>Your privacy, messages, notifications and account. Edit Profile stays on your profile page.</Text>
    </View>
    {saving && <View style={styles.saving}><ActivityIndicator color={ROSE}/><Text style={styles.savingText}>Saving your choice…</Text></View>}
    <Header number="01" title="Privacy & interactions" description="Choose who can reach you and share your moments."/>
    <View style={styles.card}>
      <SelectPreference title="Who can reply to your stories?" description="Replies arrive in Memento messages." value={current.story_replies} onChange={v=>change('story_replies',v)}/>
      <View style={styles.divider}/>
      <SelectPreference title="Who can message you?" description="Controls new messages and shares in your inbox." value={current.message_requests} onChange={v=>change('message_requests',v)}/>
      <View style={styles.divider}/>
      <Preference title="Allow others to repost my stories" description="People can share an active story to their story or page." value={current.allow_story_reshares} onChange={v=>change('allow_story_reshares',v)}/>
      <View style={styles.divider}/>
      <Preference title="Hide like counts for me" description="Hide numerical like totals while you're browsing your feed." value={current.hide_like_counts} onChange={v=>change('hide_like_counts',v)}/>
    </View>
    <Header number="02" title="Activity & insights" description="Check real interactions without the noise."/>
    <View style={styles.card}>
      <Action icon="notifications-outline" title="Activity & mentions" detail="Likes, comments, mentions and replies" onPress={onActivity}/>
      <View style={styles.divider}/>
      <Action icon="stats-chart-outline" title="Your account insights" detail="Post, Story and sharing statistics" onPress={onInsights}/>
      <View style={styles.divider}/>
      <Action icon="notifications-circle-outline" title="Device notifications" detail="Allow iPhone alerts from Memento" onPress={onNotifications}/>
      {!!notificationError && <Text style={styles.warning}>{notificationError}</Text>}
    </View>
    <Header number="03" title="Security & your data" description="Manage how you access Memento."/>
    <View style={styles.card}>
      <View style={styles.account}><Ionicons name="mail-outline" color="#303746" size={22}/><View style={{flex:1}}><Text style={styles.optionTitle}>{user.email || 'Memento account'}</Text><Text style={styles.optionHelp}>Signed in securely with Supabase</Text></View></View>
      <View style={styles.divider}/>
      <Action icon="key-outline" title="Change your password" detail="Send a password reset link to your email" onPress={passwordEmail}/>
      <View style={styles.divider}/>
      <Action icon="download-outline" title="Export your Memento activity" detail="Share a copy of posts, stories and messages metadata" onPress={exportData}/>
      <View style={styles.divider}/>
      <Action icon="phone-portrait-outline" title="Device permissions" detail="Camera, microphone, location and photos" onPress={()=>Linking.openSettings().catch(e=>Alert.alert('Settings',String(e)))}/>
      <View style={styles.divider}/>
      <Action icon="refresh-outline" title="Refresh Memento" detail="Sync your latest content and activity" onPress={onRefresh}/>
      <View style={styles.divider}/>
      <Action icon="log-out-outline" title="Sign out" detail="End your session on this device" danger onPress={()=>Alert.alert('Sign out?', 'You can sign back in any time.',[{text:'Cancel',style:'cancel'},{text:'Sign out',style:'destructive',onPress:signOut}])}/>
    </View>
    <Text style={styles.footer}>Keep the moments. Choose the rest.\nRemote push notifications need a configured native app build and delivery service.</Text>
  </View>;
}

const styles=StyleSheet.create({
  page:{backgroundColor:'#F4F5F8',paddingHorizontal:15,paddingBottom:40,paddingTop:15},
  back:{flexDirection:'row',gap:8,alignItems:'center',padding:8,marginBottom:12},
  backText:{color:'#1E2531',fontWeight:'900',fontSize:14},
  hero:{backgroundColor:'#171A22',borderRadius:23,padding:23},
  heroBadge:{width:51,height:51,borderRadius:15,backgroundColor:'#383D49',alignItems:'center',justifyContent:'center',marginBottom:21},
  kicker:{fontSize:10,fontWeight:'900',color:'#FFC9D4',letterSpacing:1.5},
  heroTitle:{color:'#fff',fontSize:29,fontWeight:'900',letterSpacing:-1,marginTop:7},
  heroText:{color:'#E6E7ED',fontSize:13.5,lineHeight:21,marginTop:10,fontWeight:'600'},
  saving:{marginTop:13,flexDirection:'row',gap:9,alignItems:'center'},savingText:{fontWeight:'800',color:'#242A35'},
  header:{flexDirection:'row',gap:11,alignItems:'center',marginTop:27,marginBottom:11},
  counter:{fontWeight:'900',fontSize:13,color:ROSE,letterSpacing:1},
  headerTitle:{fontSize:17,fontWeight:'900',color:'#222630'},
  headerHelp:{fontSize:12,color:'#4A5361',fontWeight:'650',marginTop:4},
  card:{borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#DBDFE6',paddingHorizontal:15,overflow:'hidden'},
  option:{paddingVertical:18,flexDirection:'row',alignItems:'center'},
  optionVertical:{paddingVertical:18},
  optionTitle:{fontSize:14,fontWeight:'900',color:'#20242D'},
  optionHelp:{fontSize:12,lineHeight:18,color:'#555E6C',fontWeight:'600',marginTop:5},
  selectRow:{flexDirection:'row',gap:7,marginTop:13},
  select:{flex:1,alignItems:'center',paddingVertical:12,borderRadius:12,backgroundColor:'#F0F1F5',borderWidth:1,borderColor:'#D5D9E0'},
  selected:{backgroundColor:'#242832',borderColor:'#242832'},
  selectText:{fontSize:12,fontWeight:'800',color:'#333B46'},
  selectedText:{color:'#fff'},
  divider:{height:1,backgroundColor:'#E7E9EE'},
  action:{paddingVertical:16,flexDirection:'row',gap:12,alignItems:'center'},
  actionIcon:{height:43,width:43,borderRadius:13,backgroundColor:'#F1F2F5',alignItems:'center',justifyContent:'center'},
  actionTitle:{fontSize:13.5,fontWeight:'900',color:'#222732'},
  actionDetail:{fontSize:11.5,fontWeight:'650',color:'#525B69',marginTop:4,lineHeight:16},
  account:{flexDirection:'row',alignItems:'center',gap:13,paddingVertical:19},
  warning:{color:ROSE,fontSize:12,fontWeight:'700',marginBottom:12},
  footer:{fontSize:11,color:'#555E6A',fontWeight:'700',lineHeight:18,textAlign:'center',paddingVertical:26}
});
