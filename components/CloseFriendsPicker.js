import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

export default function CloseFriendsPicker({visible,onClose,userId,selected,onToggle,busy}) {
  const [query,setQuery]=useState('');
  const [people,setPeople]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    if(!visible)return;
    let active=true;
    setLoading(true);setError('');
    const timer=setTimeout(async()=>{
      try {
        let request=supabase.from('profiles').select('id,username').neq('id',userId).order('username').limit(100);
        const term=query.trim().replace(/[%_\\]/g,'');
        if(term)request=request.ilike('username',`%${term}%`);
        const result=await request;
        if(result.error)throw result.error;
        if(active)setPeople(result.data||[]);
      } catch(e){if(active)setError(e.message||'Could not load people.');}
      finally {if(active)setLoading(false);}
    },250);
    return ()=>{active=false;clearTimeout(timer);};
  },[visible,query,userId]);
  return <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
    <SafeAreaView style={{flex:1,backgroundColor:'#fff'}}>
      <View style={{padding:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{fontSize:24,fontWeight:'800'}}>Close Friends</Text><TouchableOpacity accessibilityLabel="Close friends list done" onPress={onClose}><Text style={{color:'#197A50',fontWeight:'800',padding:10}}>Done</Text></TouchableOpacity></View>
      <Text style={{paddingHorizontal:20,color:'#596171'}}>Only people you add here can view your Close Friends stories. Changes save immediately.</Text>
      <Text style={{padding:20,fontWeight:'700'}}>{selected.length} selected</Text>
      <TextInput accessibilityLabel="Search people" placeholder="Search by username" autoCapitalize="none" value={query} onChangeText={setQuery} style={{marginHorizontal:20,padding:14,backgroundColor:'#F1F3F5',borderRadius:12}}/>
      {loading&&<ActivityIndicator style={{margin:15}}/>}
      {!!error&&<Text style={{padding:20,color:'#B32035'}}>{error}</Text>}
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:20}}>
        {!loading&&!error&&!people.length&&<Text>No matching members.</Text>}
        {people.map(person=>{const chosen=selected.includes(person.id);return <TouchableOpacity key={person.id} accessibilityRole="checkbox" accessibilityLabel={person.username||'Member'} accessibilityState={{checked:chosen,disabled:busy}} disabled={busy} onPress={()=>onToggle(person.id)} style={{flexDirection:'row',alignItems:'center',paddingVertical:16,gap:12,borderBottomWidth:1,borderColor:'#ECEEF1'}}><Ionicons name="person-circle-outline" size={34} color="#697181"/><Text style={{flex:1,fontSize:16}}>@{person.username||'member'}</Text><Ionicons name={chosen?'checkmark-circle':'ellipse-outline'} size={27} color={chosen?'#209C66':'#AFB5C0'}/></TouchableOpacity>;})}
        {selected.filter(id=>!people.some(p=>p.id===id)).map(id=><TouchableOpacity key={id} disabled={busy} accessibilityLabel="Remove selected member from close friends" onPress={()=>onToggle(id)} style={{paddingVertical:14,flexDirection:'row',justifyContent:'space-between'}}><Text>Selected member · {id.slice(0,8)}</Text><Text style={{color:'#B32035'}}>Remove</Text></TouchableOpacity>)}
      </ScrollView>
    </SafeAreaView>
  </Modal>;
}
