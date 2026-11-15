import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RED='#E4384F';
const fmt=n=>(n||0).toLocaleString();
const Kpi=({icon,label,value})=><View style={styles.kpi}><Ionicons name={icon} size={21} color="#fff"/><Text style={styles.value}>{fmt(value)}</Text><Text style={styles.label}>{label}</Text></View>;

export default function ContentInsights({
  target,posts,stories,postLikes,postComments,storyLikes,storyViews,shares,messages,profiles,onClose,onOpenProfile
}) {
  const item=target?.item;
  const isAccount=target?.kind==='account';
  const isStory=target?.kind==='story';
  const ownPosts=isAccount?posts.filter(p=>p.author_id===target.ownerId):[];
  const ownStories=isAccount?stories.filter(s=>s.author_id===target.ownerId):[];
  const idsPosts=new Set(ownPosts.map(x=>x.id));
  const idsStories=new Set(ownStories.map(x=>x.id));
  const relatedShares=(shares||[]).filter(x=>isAccount
    ? (x.source_post_id&&idsPosts.has(x.source_post_id))||(x.source_story_id&&idsStories.has(x.source_story_id))
    : isStory ? x.source_story_id===item?.id : x.source_post_id===item?.id);
  const likes=isAccount?postLikes.filter(x=>idsPosts.has(x.post_id)).length
    : isStory?storyLikes.filter(x=>x.story_id===item?.id).length
    : postLikes.filter(x=>x.post_id===item?.id).length;
  const hearts=isAccount?storyLikes.filter(x=>idsStories.has(x.story_id)).length
    : isStory?storyLikes.filter(x=>x.story_id===item?.id).length:0;
  const views=isAccount?storyViews.filter(x=>idsStories.has(x.story_id)).length
    : isStory?storyViews.filter(x=>x.story_id===item?.id).length:0;
  const comments=isAccount?postComments.filter(x=>idsPosts.has(x.post_id)).length
    : isStory?messages.filter(m=>m.reply_to_story_id===item?.id).length
    : postComments.filter(x=>x.post_id===item?.id).length;
  const viewers=isStory?storyViews.filter(x=>x.story_id===item?.id):[];
  const storyLikers=isStory?storyLikes.filter(x=>x.story_id===item?.id):[];
  const sortedShares=[...relatedShares].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const getUser=id=>profiles.find(p=>p.id===id);
  const ownerDetails=!isAccount?getUser(item?.author_id):getUser(target?.ownerId);
  const personRow=(id,description,key)=><TouchableOpacity key={key} style={styles.personRow} onPress={()=>{onClose();onOpenProfile(id);}}>
    <Ionicons name="person-circle-outline" size={35} color="#BBC4D3"/>
    <View style={{flex:1}}><Text style={styles.handle}>@{getUser(id)?.username||'member'}</Text><Text style={styles.personInfo}>{description}</Text></View>
    <Ionicons name="chevron-forward" size={18} color="#BEC4CF"/>
  </TouchableOpacity>;
  return <Modal visible={!!target} transparent={false} animationType="slide" onRequestClose={onClose}>
    <View style={styles.page}>
      <View style={styles.top}><TouchableOpacity onPress={onClose} style={styles.back}><Ionicons name="arrow-back" size={23} color="#fff"/></TouchableOpacity><Text style={styles.topTitle}>Memento Insights</Text><Ionicons name="stats-chart-outline" size={24} color="#FFC3CE"/></View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.kicker}>{isAccount?'YOUR ACCOUNT':isStory?'STORY INSIGHTS':'POST INSIGHTS'}</Text>
        <Text style={styles.heading}>{isAccount?'The moments add up.':isStory?'Your story’s impact.':'Your post’s impact.'}</Text>
        <Text style={styles.description}>{isAccount?'Stats from content currently loaded in your app.':`Your original content by @${ownerDetails?.username||'you'}.`} Only in-app interactions are counted.</Text>
        <View style={styles.grid}>
          <Kpi icon="repeat-outline" label="Shares" value={relatedShares.length}/>
          {isAccount?<Kpi icon="images-outline" label="Posts" value={ownPosts.length}/>:null}
          <Kpi icon="heart-outline" label={isAccount?'Post likes':isStory?'Story likes':'Likes'} value={likes}/>
          {(isAccount||isStory) && <Kpi icon="eye-outline" label="Story viewers" value={views}/>}
          {isAccount && <Kpi icon="heart-circle-outline" label="Story likes" value={hearts}/>}
          <Kpi icon="chatbubble-ellipses-outline" label={isStory?'Replies':'Comments'} value={comments}/>
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>Where it was shared</Text><Text style={styles.sectionCount}>{relatedShares.length} TOTAL</Text></View>
        <View style={styles.breakdown}>
          {['dm','story','page'].map((type)=><View key={type} style={styles.breakdownRow}>
            <Text style={styles.breakdownName}>{type==='dm'?'Sent to friends':type==='story'?'Reposted to stories':'Reposted to pages'}</Text>
            <Text style={styles.breakdownValue}>{fmt(relatedShares.filter(x=>x.destination===type).length)}</Text>
          </View>)}
        </View>
        <View style={styles.section}><Text style={styles.sectionTitle}>People who shared</Text><Text style={styles.sectionCount}>{relatedShares.length}</Text></View>
        {!sortedShares.length?<Text style={styles.empty}>No shares yet. Every moment starts somewhere.</Text>:
          sortedShares.slice(0,100).map(share=>personRow(share.actor_id,
            (share.destination==='story'?'Reposted to a story':share.destination==='page'?'Reposted to a page':'Sent to a friend')+
            ' · '+new Date(share.created_at).toLocaleDateString(),share.id))}
        {isStory && <>
          <View style={styles.section}><Text style={styles.sectionTitle}>Story viewers</Text><Text style={styles.sectionCount}>{views}</Text></View>
          {!viewers.length?<Text style={styles.empty}>No recorded viewers yet.</Text>:viewers.map(v=>personRow(v.viewer_id,'Viewed your story',v.viewer_id))}
          <View style={styles.section}><Text style={styles.sectionTitle}>Who liked your story</Text><Text style={styles.sectionCount}>{likes}</Text></View>
          {!storyLikers.length?<Text style={styles.empty}>No story likes yet.</Text>:storyLikers.map(v=>personRow(v.user_id,'Liked this story',v.user_id))}
        </>}
        <Text style={styles.footnote}>Only people with access to your content can interact with it. Insights don't detect screenshots, external shares or activity outside Memento.</Text>
      </ScrollView>
    </View>
  </Modal>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:'#171A22'},
  top:{paddingTop:52,paddingBottom:18,paddingHorizontal:19,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#39404C'},
  back:{padding:7},topTitle:{color:'#fff',fontWeight:'900',fontSize:15},
  scroll:{paddingHorizontal:21,paddingBottom:70,paddingTop:25},
  kicker:{color:'#FFB8C8',fontSize:11,letterSpacing:1.5,fontWeight:'900'},
  heading:{color:'#fff',fontSize:29,fontWeight:'900',marginTop:7,letterSpacing:-.8},
  description:{color:'#DBE0E9',fontSize:13,fontWeight:'650',lineHeight:20,marginTop:10,marginBottom:25},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:10},
  kpi:{width:'47%',flexGrow:1,backgroundColor:'#303641',borderWidth:1,borderColor:'#4B5361',borderRadius:17,padding:17,gap:7},
  value:{fontSize:27,fontWeight:'900',color:'#fff',marginTop:4},
  label:{fontSize:12,color:'#E5E8EE',fontWeight:'750'},
  section:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:29,marginBottom:11},
  sectionTitle:{fontSize:17,color:'#fff',fontWeight:'900'},
  sectionCount:{fontSize:10,color:'#FFD0D9',letterSpacing:1,fontWeight:'900'},
  breakdown:{backgroundColor:'#252B35',borderRadius:14,paddingHorizontal:17},
  breakdownRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:16,borderBottomColor:'#434B59',borderBottomWidth:.5},
  breakdownName:{fontSize:13,color:'#F2F3F6',fontWeight:'700'},
  breakdownValue:{color:'#fff',fontSize:15,fontWeight:'900'},
  personRow:{flexDirection:'row',gap:12,alignItems:'center',paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#39404D'},
  handle:{color:'#fff',fontSize:14,fontWeight:'850'},
  personInfo:{color:'#BBC2CF',fontWeight:'650',fontSize:12,marginTop:4},
  empty:{backgroundColor:'#252A34',padding:17,borderRadius:13,fontWeight:'700',color:'#C9D0DD',lineHeight:19},
  footnote:{fontWeight:'600',color:'#ABB3C1',fontSize:11.5,lineHeight:18,marginTop:29}
});
