import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ACCENT = '#E4384F';
const INK = '#181B22';
const CATEGORIES = ['Personal', 'Artist', 'Music producer', 'Musician', 'Designer', 'Photographer', 'Creator'];
const STICKERS = ['🖤','✨','⭐','💿','🎧','🪩','🎀','🌙','💫','🔥','🦋','💌','🫶','🎶'];
const trimmed = value => (value || '').trim();
const stripAt = value => trimmed(value).replace(/^@+/, '');

function Field({ label, value, onChangeText, placeholder, maxLength, multiline, hint, autoCapitalize = 'sentences', keyboardType = 'default', prefix }) {
  return <View style={ui.fieldBlock}>
    <View style={ui.fieldTop}><Text style={ui.fieldLabel}>{label}</Text>{maxLength && <Text style={ui.count}>{(value || '').length}/{maxLength}</Text>}</View>
    <View style={[ui.inputWrap, multiline && ui.multiWrap]}>
      {!!prefix && <Text style={ui.prefix}>{prefix}</Text>}
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#737985"
        autoCapitalize={autoCapitalize} keyboardType={keyboardType} autoCorrect={false}
        multiline={multiline} maxLength={maxLength} style={[ui.input, multiline && ui.multiInput, !!prefix && {paddingLeft:0}]}/>
    </View>
    {!!hint && <Text style={ui.fieldHint}>{hint}</Text>}
  </View>;
}
export default function ProfileEditor({ profile, user, supabase, onCancel, onSaved }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [handle, setHandle] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [category, setCategory] = useState(profile?.category || 'Personal');
  const [pronouns, setPronouns] = useState(profile?.pronouns || '');
  const [website, setWebsite] = useState(profile?.website || '');
  const [instagram, setInstagram] = useState(profile?.instagram || '');
  const [tiktok, setTiktok] = useState(profile?.tiktok || '');
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState('idle');
  const normalizedHandle = stripAt(handle).toLowerCase();
  const validHandle = /^[a-z0-9_]{3,24}$/.test(normalizedHandle);
  const previewName = trimmed(displayName) || normalizedHandle || 'Your name';

  useEffect(() => {
    if (!validHandle) {setAvailability('invalid'); return;}
    if (normalizedHandle === profile?.username?.toLowerCase()) {setAvailability('yours');return;}
    let active = true;
    setAvailability('checking');
    const t = setTimeout(async () => {
      try {
        const {data, error} = await supabase.from('profiles').select('id').ilike('username', normalizedHandle).neq('id', user.id).limit(1);
        if (active) setAvailability(error ? 'unknown' : (data?.length ? 'taken' : 'available'));
      } catch (_) {if (active) setAvailability('unknown');}
    }, 450);
    return () => {active = false; clearTimeout(t);};
  }, [normalizedHandle, validHandle, profile?.username, user.id, supabase]);

  const changed = useMemo(() =>
    displayName !== (profile?.display_name || '') ||
    normalizedHandle !== (profile?.username || '').toLowerCase() ||
    bio !== (profile?.bio || '') ||
    category !== (profile?.category || 'Personal') ||
    pronouns !== (profile?.pronouns || '') ||
    website !== (profile?.website || '') ||
    instagram !== (profile?.instagram || '') ||
    tiktok !== (profile?.tiktok || ''),
    [displayName,normalizedHandle,bio,category,pronouns,website,instagram,tiktok,profile]
  );

  async function save() {
    if (saving) return;
    if (!validHandle) return Alert.alert('Username', 'Use 3–24 letters, numbers, or underscores.');
    if (availability === 'taken') return Alert.alert('Username already taken','Choose another username.');
    if (trimmed(displayName).length > 50) return Alert.alert('Display name','50 characters maximum.');
    if (trimmed(bio).length > 300) return Alert.alert('Bio','300 characters maximum.');
    const ig = stripAt(instagram), tk = stripAt(tiktok);
    if (ig && !/^[a-z0-9._]{1,30}$/i.test(ig)) return Alert.alert('Instagram', 'Enter a valid Instagram username, without spaces.');
    if (tk && !/^[a-z0-9._]{1,24}$/i.test(tk)) return Alert.alert('TikTok', 'Enter a valid TikTok username, without spaces.');
    let site = trimmed(website);
    if (site) {
      if (!/^https?:\/\//i.test(site)) site = 'https://' + site;
      try {
        const url = new URL(site);
        if (!['https:','http:'].includes(url.protocol) || !url.hostname.includes('.')) throw Error('Invalid link');
        site = url.toString();
      } catch (_) {return Alert.alert('Website','Enter a valid website, like https://example.com');}
    }
    setSaving(true);
    try {
      const values = {
        username:normalizedHandle,
        display_name: trimmed(displayName) || null,
        bio:trimmed(bio),
        category,
        pronouns:trimmed(pronouns) || null,
        website:site || null,
        instagram:ig || null,
        tiktok:tk || null,
      };
      const {data,error} = await supabase.from('profiles').update(values).eq('id',user.id).select('*').single();
      if (error) throw error;
      await onSaved(data);
    } catch (e) {
      Alert.alert('Could not save profile', (e?.code === '23505' ? 'This username is already taken.' :
        /column|schema cache/i.test(e?.message || '') ?
        'Profile setup may be missing. Run the profile upgrade SQL in Supabase, then try again.\n\n' + e.message : e?.message || String(e)));
    } finally {setSaving(false);}
  }

  return <View style={ui.page}>
    <View style={ui.topRow}>
      <TouchableOpacity onPress={onCancel} disabled={saving} accessibilityRole="button" style={ui.topClose}><Ionicons name="chevron-back" size={20} color={INK}/><Text style={ui.topCloseLabel}>Profile</Text></TouchableOpacity>
      <Text style={ui.pageKicker}>ACCOUNT / EDIT</Text>
    </View>
    <Text style={ui.title}>Make it yours.</Text>
    <Text style={ui.subtitle}>Your name, your story, your links. Nothing extra.</Text>

    <View style={ui.previewCard}>
      <View style={ui.previewGlow}/>
      <View style={ui.previewKickerRow}><View style={ui.previewDot}/><Text style={ui.previewKicker}>LIVE PROFILE PREVIEW</Text></View>
      <View style={ui.previewIdentity}>
        <View style={{flex:1}}><Text numberOfLines={1} style={ui.previewName}>{previewName}</Text><Text numberOfLines={1} style={ui.previewHandle}>@{normalizedHandle || 'username'}</Text><Text style={ui.previewCategory}>{category}{trimmed(pronouns) ? ' · '+trimmed(pronouns) : ''}</Text></View>
      </View>
      {!!trimmed(bio) && <Text style={ui.previewBio} numberOfLines={3}>{bio}</Text>}
      <View style={ui.previewFooter}><Ionicons name="eye-outline" size={17} color="#E5E7EB"/><Text style={ui.previewFootText}>This is how others will see your profile.</Text></View>
    </View>
    <Text style={ui.sectionHeading}>01 / ABOUT YOU</Text>
    <View style={ui.sectionCard}>
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={50} placeholder="The name people know you by"/>
      <Field label="Username" value={handle} onChangeText={setHandle} maxLength={24} placeholder="yourname" prefix="@" autoCapitalize="none"/>
      <View style={ui.statusRow}><Ionicons name={availability==='taken'||availability==='invalid'?'close-circle':availability==='available'||availability==='yours'?'checkmark-circle':'information-circle-outline'} color={availability==='taken'||availability==='invalid'?ACCENT:availability==='available'||availability==='yours'?'#16865D':'#5E6572'} size={16}/>
        <Text style={ui.statusText}>{availability==='taken'?'That username is taken.':availability==='invalid'?'3–24 letters, numbers or underscores.':availability==='available'?'Username available.':availability==='yours'?'This is your current username.':availability==='checking'?'Checking username…':'Username availability could not be checked.'}</Text>
      </View>
      <Field label="Bio" value={bio} onChangeText={setBio} maxLength={300} multiline placeholder="What do you make? What makes you, you?"/>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={ui.emojiRow} contentContainerStyle={{gap:8}}>{STICKERS.map((sticker,i)=><TouchableOpacity key={i} onPress={()=>setBio(x=>(x+sticker).slice(0,300))} style={ui.emoji}><Text style={{fontSize:21}}>{sticker}</Text></TouchableOpacity>)}</ScrollView>
    </View>

    <Text style={ui.sectionHeading}>02 / YOUR VIBE</Text>
    <View style={ui.sectionCard}>
      <Text style={ui.fieldLabel}>Category</Text>
      <View style={ui.chips}>{CATEGORIES.map(x=><TouchableOpacity key={x} onPress={()=>setCategory(x)} style={[ui.chip,category===x&&ui.chipActive]} accessibilityRole="button"><Text style={[ui.chipText,category===x&&ui.chipTextActive]}>{x}</Text></TouchableOpacity>)}</View>
      <Field label="Pronouns (optional)" value={pronouns} onChangeText={setPronouns} maxLength={32} placeholder="e.g. she/her, they/them"/>
    </View>

    <Text style={ui.sectionHeading}>03 / LINKS & SOCIALS</Text>
    <View style={ui.sectionCard}>
      <Field label="Website" value={website} onChangeText={setWebsite} maxLength={200} autoCapitalize="none" keyboardType="url" placeholder="https://yoursite.com"/>
      <Field label="Instagram" value={instagram} onChangeText={setInstagram} maxLength={30} autoCapitalize="none" prefix="@" placeholder="instagram username"/>
      <Field label="TikTok" value={tiktok} onChangeText={setTiktok} maxLength={24} autoCapitalize="none" prefix="@" placeholder="tiktok username"/>
      <Text style={ui.disclosure}>Your public profile shows these links. Leave them blank to hide them.</Text>
    </View>

    <TouchableOpacity accessibilityRole="button" onPress={save} disabled={saving || !changed || !validHandle || availability==='taken'} style={[ui.saveButton,(saving || !changed || !validHandle || availability==='taken')&&ui.saveDisabled]}>
      {saving ? <ActivityIndicator color="#fff"/> : <Ionicons name="checkmark-circle-outline" color="#fff" size={21}/>}
      <Text style={ui.saveText}>{saving ? 'Saving changes…' : 'Save profile changes'}</Text>
    </TouchableOpacity>
    <TouchableOpacity disabled={saving} onPress={onCancel} style={ui.cancelButton}><Text style={ui.cancelText}>Discard changes</Text></TouchableOpacity>
    <Text style={ui.bottomNote}>Only saved changes appear on your public profile.</Text>
  </View>;
}
const ui = StyleSheet.create({
  page:{backgroundColor:'#F4F5F8',paddingHorizontal:19,paddingTop:16,paddingBottom:33},
  topRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:20},
  topClose:{flexDirection:'row',alignItems:'center',gap:2,paddingVertical:7},
  topCloseLabel:{fontSize:15,fontWeight:'800',color:INK},
  pageKicker:{fontSize:10,fontWeight:'900',letterSpacing:1.7,color:'#4D5663'},
  title:{fontSize:33,fontWeight:'900',letterSpacing:-1.5,color:'#151820'},
  subtitle:{fontSize:14,fontWeight:'600',color:'#4C535F',marginTop:5,marginBottom:24},
  previewCard:{backgroundColor:'#171A22',borderRadius:24,padding:20,overflow:'hidden'},
  previewGlow:{position:'absolute',right:-60,top:-65,height:175,width:175,borderRadius:88,backgroundColor:'#323944'},
  previewKickerRow:{flexDirection:'row',alignItems:'center',gap:7,marginBottom:18},
  previewDot:{width:7,height:7,borderRadius:4,backgroundColor:ACCENT},
  previewKicker:{color:'#F0F1F4',fontSize:10,letterSpacing:1.6,fontWeight:'900'},
  previewIdentity:{flexDirection:'row',alignItems:'center',gap:14},
  previewName:{color:'#fff',fontSize:21,fontWeight:'900',letterSpacing:-.4},
  previewHandle:{color:'#F1B7C1',fontWeight:'700',marginTop:3,fontSize:13},
  previewCategory:{color:'#E0E3E9',fontWeight:'700',marginTop:7,fontSize:12},
  previewBio:{color:'#FAFAFC',fontSize:14,lineHeight:21,marginTop:17,fontWeight:'500'},
  previewFooter:{flexDirection:'row',alignItems:'center',gap:8,borderTopWidth:1,borderTopColor:'#444853',marginTop:18,paddingTop:12},
  previewFootText:{color:'#E5E7EB',fontSize:11,fontWeight:'600'},
  sectionHeading:{fontSize:13,letterSpacing:1.6,fontWeight:'900',color:'#272B34',marginTop:23,marginBottom:10,marginLeft:2},
  sectionCard:{backgroundColor:'#fff',borderWidth:1,borderColor:'#DDE0E6',borderRadius:20,padding:16,gap:1},
  fieldBlock:{marginBottom:17},
  fieldTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},
  fieldLabel:{color:'#242832',fontSize:13,fontWeight:'900',letterSpacing:.1},
  count:{fontSize:11,color:'#4C5361',fontWeight:'700'},
  inputWrap:{borderRadius:12,backgroundColor:'#F7F8FA',borderWidth:1.5,borderColor:'#D3D7DF',flexDirection:'row',alignItems:'center',paddingHorizontal:13},
  input:{color:'#151820',fontSize:15,fontWeight:'600',flex:1,paddingVertical:13,minHeight:48},
  prefix:{fontSize:16,fontWeight:'900',color:'#515765',marginRight:5},
  multiWrap:{alignItems:'flex-start',minHeight:118},
  multiInput:{minHeight:118,textAlignVertical:'top',paddingTop:13},
  fieldHint:{color:'#505662',fontSize:11,lineHeight:17,marginTop:5},
  statusRow:{flexDirection:'row',gap:6,alignItems:'center',marginTop:-7,marginBottom:16},
  statusText:{fontSize:12,fontWeight:'700',color:'#424A56',flex:1},
  emojiRow:{marginTop:-6,marginBottom:3},
  emoji:{backgroundColor:'#F0F1F4',borderWidth:1,borderColor:'#DFE2E8',padding:8,borderRadius:12},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:16,marginTop:12},
  chip:{backgroundColor:'#F3F4F7',borderWidth:1,borderColor:'#CED2D9',borderRadius:22,paddingHorizontal:12,paddingVertical:9},
  chipActive:{backgroundColor:'#1E222B',borderColor:'#1E222B'},
  chipText:{color:'#333844',fontSize:12,fontWeight:'800'},
  chipTextActive:{color:'#fff'},
  disclosure:{color:'#424955',fontSize:12,fontWeight:'600',lineHeight:18,marginTop:-4},
  saveButton:{backgroundColor:ACCENT,borderRadius:15,paddingVertical:19,alignItems:'center',justifyContent:'center',flexDirection:'row',gap:8,marginTop:25},
  saveDisabled:{opacity:.46},
  saveText:{color:'#fff',fontSize:15,fontWeight:'900'},
  cancelButton:{alignItems:'center',paddingVertical:17},
  cancelText:{color:'#323945',fontSize:14,fontWeight:'800'},
  bottomNote:{color:'#5D6572',fontSize:11,textAlign:'center',fontWeight:'600'}
});
