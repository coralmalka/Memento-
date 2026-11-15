import React, {useState} from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ROSE='#E4384F';
function ShareAction({icon,title,detail,onPress,disabled}) {
  return <TouchableOpacity disabled={disabled} accessibilityRole="button" onPress={onPress} style={[styles.action,disabled&&{opacity:.5}]}>
    <View style={styles.actionIcon}><Ionicons name={icon} size={23} color="#fff"/></View>
    <View style={{flex:1}}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View>
    <Ionicons name="chevron-forward" size={19} color="#B6BDCA"/>
  </TouchableOpacity>;
}
export default function ShareComposer({target,profiles,userId,busy,onClose,onRepost,onSendFriend}) {
  const [query,setQuery]=useState('');
  const source=target?.item;
  const author=profiles.find(x=>x.id===source?.author_id);
  const candidates=profiles.filter(x=>x.id!==userId && (x.username||'').toLowerCase().includes(query.toLowerCase())).slice(0,30);
  return <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={styles.scrim}>
      <TouchableOpacity style={{flex:1}} onPress={onClose}/>
      <View style={styles.sheet}>
        <View style={styles.grabber}/>
        <View style={styles.header}><View style={{flex:1}}><Text style={styles.kicker}>PASS THE MOMENT</Text><Text style={styles.heading}>Share this {target?.kind==='story'?'story':'post'}.</Text></View>
          <TouchableOpacity style={styles.close} onPress={onClose}><Ionicons name="close" size={23} color="#fff"/></TouchableOpacity>
        </View>
        <View style={styles.source}>
          {!!source?.image_url && <Image source={{uri:source.image_url}} style={styles.image}/>}
          <View style={{flex:1}}><Text style={styles.sourceTitle}>@{author?.username||'member'}</Text>
            <Text numberOfLines={2} style={styles.sourceCaption}>{source?.caption||'A moment worth keeping.'}</Text></View>
        </View>
        <ShareAction icon="aperture-outline" title="Repost to my Story" detail="Share for 24 hours" onPress={()=>onRepost('story')} disabled={busy}/>
        <ShareAction icon="repeat-outline" title="Repost to my page" detail="Keep this on your profile and Reposts" onPress={()=>onRepost('page')} disabled={busy}/>
        <View style={styles.sectionTop}><Ionicons name="paper-plane-outline" size={18} color="#fff"/><Text style={styles.sectionName}>SEND TO A FRIEND</Text></View>
        <TextInput style={styles.search} autoCapitalize="none" placeholder="Search @username" placeholderTextColor="#9299A6" value={query} onChangeText={setQuery}/>
        <ScrollView keyboardShouldPersistTaps="always" style={{maxHeight:210}} contentContainerStyle={{paddingBottom:6}}>
          {candidates.length?candidates.map(person=><TouchableOpacity key={person.id} style={styles.friend} disabled={busy} onPress={()=>{setQuery('');onSendFriend(person.id);}}>
            <View style={styles.person}><Ionicons name="person-circle-outline" size={37} color="#D1D5DD"/></View>
            <View style={{flex:1}}><Text style={styles.friendHandle}>@{person.username}</Text><Text style={styles.friendSub}>Send as a Memento message</Text></View>
            <Ionicons name="send" size={20} color={ROSE}/>
          </TouchableOpacity>):<Text style={styles.empty}>No members match that name.</Text>}
        </ScrollView>
        <Text style={styles.footer}>Sharing inside Memento is recorded for the creator's insights.</Text>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const styles=StyleSheet.create({
  scrim:{flex:1,backgroundColor:'rgba(0,0,0,.48)',justifyContent:'flex-end'},
  sheet:{backgroundColor:'#171A22',borderTopLeftRadius:27,borderTopRightRadius:27,paddingHorizontal:21,paddingTop:11,paddingBottom:25},
  grabber:{alignSelf:'center',height:5,width:48,borderRadius:3,backgroundColor:'#858A96',marginBottom:18},
  header:{flexDirection:'row',alignItems:'center',marginBottom:13},
  kicker:{color:'#FFBBC9',fontWeight:'900',letterSpacing:1.4,fontSize:10},
  heading:{color:'#fff',fontWeight:'900',fontSize:24,letterSpacing:-.5,marginTop:4},
  close:{width:43,height:43,alignItems:'center',justifyContent:'center',borderRadius:22,backgroundColor:'#333946'},
  source:{backgroundColor:'#292E39',padding:12,borderRadius:16,flexDirection:'row',gap:12,alignItems:'center',marginBottom:13},
  image:{width:54,height:54,borderRadius:11,backgroundColor:'#222'},
  sourceTitle:{color:'#fff',fontWeight:'900',fontSize:13},
  sourceCaption:{color:'#DCE0E8',fontSize:12,lineHeight:17,marginTop:4,fontWeight:'550'},
  action:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12},
  actionIcon:{height:43,width:43,borderRadius:13,alignItems:'center',justifyContent:'center',backgroundColor:'#343B48'},
  actionTitle:{color:'#fff',fontSize:14,fontWeight:'900'},
  actionDetail:{color:'#C0C6D0',fontSize:11.5,marginTop:4,fontWeight:'600'},
  sectionTop:{marginTop:13,marginBottom:12,flexDirection:'row',alignItems:'center',gap:9},
  sectionName:{fontSize:11,fontWeight:'900',letterSpacing:1.1,color:'#fff'},
  search:{backgroundColor:'#303541',borderWidth:1,borderColor:'#4B5363',borderRadius:13,padding:13,color:'#fff',fontSize:14,fontWeight:'650',marginBottom:7},
  friend:{flexDirection:'row',alignItems:'center',gap:11,borderBottomWidth:.5,borderBottomColor:'#505665',paddingVertical:10},
  person:{height:39,width:39,borderRadius:20,alignItems:'center',justifyContent:'center'},
  friendHandle:{color:'#fff',fontWeight:'850',fontSize:14},
  friendSub:{color:'#D2D5DC',fontWeight:'600',fontSize:11.5,marginTop:3},
  empty:{color:'#D3D6DE',fontWeight:'700',paddingVertical:23,textAlign:'center'},
  footer:{fontWeight:'600',fontSize:11,color:'#CBD1DC',textAlign:'center',marginTop:12}
});
