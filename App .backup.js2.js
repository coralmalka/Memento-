import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, SafeAreaView, ScrollView, Share, Linking, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { configured, supabase } from './lib/supabase';
import { pickImage, uploadImage, signedImage } from './lib/media';
import { HashtagText } from './lib/hashtags';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { WebView } from 'react-native-webview';
import { chooseOriginalAudio, uploadOriginalAudio, signedAudio, trackMetadata, providerFor, searchAppleCatalog } from './lib/music';

const RED = '#E4384F';
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }) });
const Button = ({ title, onPress, secondary, disabled }) => <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && { opacity: .5 }]}><Text style={[styles.buttonText, secondary && { color: '#202020' }]}>{title}</Text></TouchableOpacity>;
const Photo = ({ uri, style }) => uri ? <Image source={{ uri }} style={style} /> : <View style={[style, { backgroundColor: '#e8e5e1' }]} />;
const username = p => p?.username || 'member';
const message = e => Alert.alert('Memento', e?.message || String(e));
const musicService = url => /open\.spotify\.com/i.test(url) ? 'Spotify' : /(?:music\.apple\.com|itunes\.apple\.com)/i.test(url) ? 'Apple Music / iTunes' : /soundcloud\.com/i.test(url) ? 'SoundCloud' : null;
const validMusic = value => !value.trim() || (/^https:\/\/[^\s]+$/i.test(value.trim()) && !!musicService(value));
const Mini = ({ children, onPress }) => <TouchableOpacity onPress={onPress} style={styles.miniAction}><Text style={styles.miniActionText}>{children}</Text></TouchableOpacity>;


const MUSIC_PLATFORMS = [
  { id: 'spotify', label: 'Spotify', search: 'https://open.spotify.com/search/' },
  { id: 'soundcloud', label: 'SoundCloud', search: 'https://soundcloud.com/search/sounds?q=' },
  { id: 'apple', label: 'Apple Music / iTunes', search: 'https://music.apple.com/us/search?term=' },
];
function AudioPreview({ uri }) {
  const player = useAudioPlayer(uri || null);
  const status = useAudioPlayerStatus(player);
  return <TouchableOpacity style={styles.audioPlayButton} disabled={!uri} onPress={() => {
    if (status.playing) player.pause(); else player.play();
  }}><Text style={styles.audioPlayText}>{status.playing ? '❚❚ Pause original audio' : '▶ Play original audio'}</Text></TouchableOpacity>;
}
function MusicDisplay({ item }) {
  if (!item?.music_url && !item?.original_audio_path) return null;
  const isSoundCloud = item.music_provider === 'soundcloud' && providerFor(item.music_url) === 'soundcloud';
  return <View style={styles.musicCard}>
    <Text style={styles.musicCardTitle}>♫ {item.music_title || (item.original_audio_path ? 'Original audio' : musicService(item.music_url) || 'Music')}</Text>
    {!!item.music_artist && <Text style={styles.musicCardArtist}>{item.music_artist}</Text>}
    {!!item.original_audio_path ? <AudioPreview uri={item.original_audio_url}/> : <>
      {isSoundCloud && <View style={{ height: 125, marginTop: 10, overflow: 'hidden', borderRadius: 10 }}>
        <WebView
          source={{ uri: `https://w.soundcloud.com/player/?url=${encodeURIComponent(item.music_url)}&auto_play=false&hide_related=true&show_comments=false` }}
          originWhitelist={['https://*']}
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          style={{ flex: 1, backgroundColor: '#fff' }}
        />
      </View>}
      <TouchableOpacity onPress={() => Linking.openURL(item.music_url)}><Text style={styles.musicLink}>Open on {musicService(item.music_url) || 'music service'} ↗</Text></TouchableOpacity>
    </>}
  </View>;
}
function MusicComposer({ value, onChange }) {
  const mode = value?.mode || 'none';
  const [searchTerm, setSearchTerm] = useState('');
  const [lookingUp, setLookingUp] = useState(false);
  const [results, setResults] = useState([]);
  const [searchError, setSearchError] = useState('');
  const choose = id => { setResults([]); setSearchError(''); onChange({ mode: id, url: '', title: '', artist: '', file: null }); };
  const service = MUSIC_PLATFORMS.find(x => x.id === mode);
  async function searchSongs() {
    if (!searchTerm.trim()) return Alert.alert('Search music', 'Enter a song or artist.');
    if (mode !== 'apple') return Linking.openURL(service.search + encodeURIComponent(searchTerm.trim()));
    setLookingUp(true); setResults([]); setSearchError('');
    try {
      const matches = await searchAppleCatalog(searchTerm.trim());
      setResults(matches);
      if (!matches.length) setSearchError('No matching tracks. Try another title or artist.');
    } catch (e) { setSearchError(e.message || 'Search unavailable.'); }
    finally { setLookingUp(false); }
  }
  async function readLink() {
    if (!providerFor(value.url) || providerFor(value.url) !== mode) {
      Alert.alert('Wrong music link', `Paste an official ${service?.label || 'music'} track URL.`);
      return;
    }
    setLookingUp(true);
    try {
      const result = await trackMetadata(value.url);
      onChange({ ...value, title: result.title || value.title, artist: result.artist || value.artist });
    } catch (e) { message(e); } finally { setLookingUp(false); }
  }
  async function chooseFile() {
    try { const file = await chooseOriginalAudio(); if (file) onChange({ ...value, file }); }
    catch (e) { message(e); }
  }
  return <View style={styles.musicComposer}>
    <Text style={styles.musicSectionTitle}>♫ Add music (optional)</Text>
    <View style={styles.musicChoices}>
      {[{id:'none',label:'None'}, ...MUSIC_PLATFORMS, {id:'original',label:'Original audio'}].map(x =>
        <TouchableOpacity key={x.id} style={[styles.musicChoice,mode===x.id&&styles.musicChoiceActive]} onPress={()=>choose(x.id)}>
          <Text style={[styles.musicChoiceText,mode===x.id&&styles.musicChoiceTextActive]}>{x.label}</Text>
        </TouchableOpacity>)}
    </View>
    {service && <>
      <Text style={styles.musicHint}>{mode === 'apple' ? 'Search the Apple Music/iTunes catalog without signing in. Tracks are linked, not streamed inside Memento.' : `Find a track on ${service.label} without signing in, then copy its link.`}</Text>
      <TextInput style={styles.field} value={searchTerm} onChangeText={setSearchTerm} placeholder="Search artist or song" returnKeyType="search" onSubmitEditing={searchSongs}/>
      <Mini onPress={searchSongs}>{lookingUp ? 'Searching…' : `Search ${service.label} ${mode==='apple' ? 'in Memento' : '↗'}`}</Mini>
      {mode === 'apple' && results.map(track => <TouchableOpacity key={track.id} onPress={()=>onChange({ ...value, url:track.url, title:track.title, artist:track.artist })} style={{paddingHorizontal:20,paddingVertical:9,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:.5,borderColor:'#E1E3E8'}}>
        {!!track.artwork && <Image source={{uri:track.artwork}} style={{width:45,height:45,borderRadius:7}}/>}
        <View style={{flex:1}}><Text numberOfLines={1} style={{fontWeight:'700',color:'#202631'}}>{track.title}</Text><Text numberOfLines={1} style={{color:'#717887',fontSize:12}}>{track.artist}</Text></View>
        <Text style={{color:RED,fontWeight:'800'}}>{value.url === track.url ? '✓' : '＋'}</Text>
      </TouchableOpacity>)}
      {!!searchError && <Text style={styles.musicHint}>{searchError}</Text>}
      <TextInput style={styles.field} value={value.url || ''} onChangeText={url=>onChange({...value,url})} autoCapitalize="none" autoCorrect={false} placeholder="Selected track URL or paste link" />
      <Mini onPress={readLink}>{lookingUp ? 'Finding track…' : 'Read details from link'}</Mini>
      <TextInput style={styles.field} value={value.title || ''} onChangeText={title=>onChange({...value,title})} placeholder="Track title" maxLength={120}/>
      <TextInput style={styles.field} value={value.artist || ''} onChangeText={artist=>onChange({...value,artist})} placeholder="Artist / producer" maxLength={120}/>
      <Text style={styles.musicHint}>{mode === 'soundcloud' ? 'Public tracks may play using SoundCloud’s embedded player. Artist restrictions still apply.' : 'Memento shows song details and a link. Full streaming or syncing music to photos requires separate rights and platform approval.'}</Text>
    </>}
    {mode === 'original' && <>
      <Mini onPress={chooseFile}>{value.file ? 'Change audio file' : 'Choose MP3 / M4A / WAV / AAC'}</Mini>
      <Text style={styles.musicHint}>{value.file?.name || '20 MB maximum. Upload music you created or have permission to share.'}</Text>
      <TextInput style={styles.field} value={value.title || ''} onChangeText={title=>onChange({...value,title})} placeholder="Beat or song title" maxLength={120}/>
      <TextInput style={styles.field} value={value.artist || ''} onChangeText={artist=>onChange({...value,artist})} placeholder="Artist / producer credit" maxLength={120}/>
    </>}
  </View>;
}

function Auth({ onSuccess }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false);
  async function submit() {
    if (!email.trim() || password.length < 6) return message('Enter an email and password of at least 6 characters.');
    setBusy(true);
    const result = register ? await supabase.auth.signUp({ email: email.trim(), password }) : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (result.error) message(result.error);
    else if (register && !result.data.session) Alert.alert('Check your email', 'Confirm your email address, then sign in.');
    else onSuccess?.();
  }
  return <SafeAreaView style={styles.safe}><View style={styles.auth}>
    <Text style={styles.brand}>memento</Text><Text style={styles.subheading}>Your moments. Your people.</Text>
    <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email" style={styles.field} />
    <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password (6+ characters)" style={styles.field} />
    <Button title={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} disabled={busy} onPress={submit}/>
    <Button secondary title={register ? 'Already have an account? Sign in' : 'New here? Create account'} onPress={() => setRegister(!register)}/>
  </View></SafeAreaView>;
}

export default function App() {
  const [session, setSession] = useState(null); const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState('home'); const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]); const [stories, setStories] = useState([]);
  const [archive, setArchive] = useState([]); const [sharedStories, setSharedStories] = useState([]); const [collections, setCollections] = useState([]);
  const [follows, setFollows] = useState([]); const [collectionItems, setCollectionItems] = useState([]);
  const [seenProfile, setSeenProfile] = useState(null); const [search, setSearch] = useState('');
  const [searchType, setSearchType] = useState('people'); const [caption, setCaption] = useState('');
  const [photoUri, setPhotoUri] = useState(null); const [storyPhoto, setStoryPhoto] = useState(null);
  const [storyCaption, setStoryCaption] = useState(''); const [editor, setEditor] = useState(null);
  const [editorTitle, setEditorTitle] = useState(''); const [editorVisibility, setEditorVisibility] = useState('private');
  const [editorCoverPath, setEditorCoverPath] = useState(null); const [editorStoryIds, setEditorStoryIds] = useState([]);
  const [viewer, setViewer] = useState(null); const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false); const [profileEdit, setProfileEdit] = useState(false);
  const [likedPosts, setLikedPosts] = useState({});
  const [likes, setLikes] = useState([]); const [comments, setComments] = useState([]);
  const [commenting, setCommenting] = useState(null); const [commentDraft, setCommentDraft] = useState('');
  const [sharePost, setSharePost] = useState(null); const [shareDestination, setShareDestination] = useState('memento');
  const [postMusic, setPostMusic] = useState({mode:'none'}); const [storyMusic, setStoryMusic] = useState({mode:'none'});
  const [locationLabel, setLocationLabel] = useState(''); const [storyLocationLabel, setStoryLocationLabel] = useState('');
  const [locationOn, setLocationOn] = useState(false); const [storyLocationOn, setStoryLocationOn] = useState(false);
  const [publishTo, setPublishTo] = useState('memento');
  const [activity, setActivity] = useState([]); const [directMessages, setDirectMessages] = useState([]);
  const [dmPerson, setDmPerson] = useState(null); const [dmDraft, setDmDraft] = useState('');
  const [notificationError, setNotificationError] = useState('');

  const [newUsername, setNewUsername] = useState(''); const [newBio, setNewBio] = useState('');
  const me = session?.user?.id; const mine = profiles.find(p => p.id === me);
  const profileId = seenProfile || me; const profile = profiles.find(p => p.id === profileId);

  useEffect(() => {
    if (!supabase) { setBooting(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setBooting(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const hydrateImages = async rows => Promise.all((rows || []).map(async r => ({ ...r,
    image_url: r.image_path ? await signedImage(r.image_path) : null,
    cover_url: r.cover_path ? await signedImage(r.cover_path) : null,
    original_audio_url: r.original_audio_path ? await signedAudio(r.original_audio_path).catch(() => null) : null,
  })));

  const load = useCallback(async () => {
    if (!me) return;
    try {
      const now = new Date().toISOString();
      const results = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('follows').select('*').eq('follower_id', me),
        supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('stories').select('*').not('published_at', 'is', null).gt('expires_at', now).order('published_at', { ascending: false }).limit(100),
        supabase.from('stories').select('*').eq('author_id', me).order('created_at', { ascending: false }),
        supabase.from('collections').select('*').order('sort_order', { ascending: true }),
        supabase.from('collection_stories').select('*').order('position', { ascending: true }),
        supabase.from('post_likes').select('post_id,user_id').limit(2000),
        supabase.from('post_comments').select('*').order('created_at', { ascending: true }).limit(2000),
        supabase.from('notifications').select('*').eq('recipient_id', me).order('created_at', { ascending: false }).limit(100),
        supabase.from('direct_messages').select('*').or(`sender_id.eq.${me},recipient_id.eq.${me}`).order('created_at', { ascending: false }).limit(300),
      ]);
      const err = results.find(r => r.error)?.error; if (err) throw err;
      setProfiles(results[0].data); setFollows(results[1].data);
      setPosts(await hydrateImages(results[2].data));
      setStories(await hydrateImages(results[3].data));
      setArchive(await hydrateImages(results[4].data));
      setCollections(await hydrateImages(results[5].data));
      setCollectionItems(results[6].data);
      setLikes(results[7].data || []); setComments(results[8].data || []);
      setActivity(results[9].data || []); setDirectMessages(results[10].data || []);
      const storyIds = [...new Set(results[6].data.map(x => x.story_id))];
      if (storyIds.length) {
        const { data: allowed, error: shareError } = await supabase.from('stories').select('*').in('id', storyIds);
        if (shareError) throw shareError;
        setSharedStories(await hydrateImages(allowed));
      } else setSharedStories([]);
    } catch (e) { message(e); }
  }, [me]);
  useEffect(() => { if (me) load(); else { setPosts([]); setArchive([]); setCollections([]); setSeenProfile(null); } }, [me, load]);
  useEffect(() => { if (!me) return; const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [me, load]);
  useEffect(() => {
    if (!me) return;
    const channel = supabase.channel(`memento-alerts-${me}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_id=eq.${me}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${me}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [me, load]);
  async function enablePush() {
    try {
      if (Platform.OS === 'web') throw Error('Push alerts require the iOS or Android app.');
      const permission = await Notifications.getPermissionsAsync();
      const status = permission.granted ? permission : await Notifications.requestPermissionsAsync();
      if (!status.granted) throw Error('Notifications not allowed. You can enable them in iPhone Settings.');
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      if (!projectId) throw Error('An EAS project ID is required. Configure app.json and build your app to receive push notifications.');
      if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('social', { name: 'Memento activity', importance: Notifications.AndroidImportance.MAX });
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      const { error } = await supabase.from('push_tokens').upsert({ user_id: me, expo_push_token: token }, { onConflict: 'user_id,expo_push_token' });
      if (error) throw error;
      setNotificationError(''); Alert.alert('Notifications enabled', 'This device is registered for Memento alerts. Server push delivery must also be deployed.');
    } catch (e) { setNotificationError(String(e?.message || e)); message(e); }
  }
  async function openActivity() {
    setTab('activity');
    const unread = activity.filter(n => !n.read_at).map(n => n.id);
    if (unread.length) {
      const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).in('id', unread);
      if (!error) setActivity(old => old.map(n => unread.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n));
    }
  }
  function openNotification(n) {
    if (n.type === 'message' && n.actor_id) { setDmPerson(n.actor_id); setTab('inbox'); }
    else if (n.actor_id) navigateProfile(n.actor_id);
  }
  async function sendDM() {
    if (!dmPerson || !dmDraft.trim() || busy) return;
    await run(async () => {
      const { error } = await supabase.from('direct_messages').insert({ sender_id: me, recipient_id: dmPerson, body: dmDraft.trim() });
      if (error) throw error;
      setDmDraft('');
    });
  }
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  async function run(task) { if (busy) return; setBusy(true); try { await task(); await load(); } catch (e) { message(e); } finally { setBusy(false); } }
  const table = async (name, values) => { const { data, error } = await supabase.from(name).insert(values).select(); if (error) throw error; return data; };
  const imagePath = async uri => { if (!uri) throw Error('Choose a photo first.'); return uploadImage(me, uri); };
  const navigateProfile = id => { setSeenProfile(id); setTab('profile'); setViewer(null); };
  const searchTag = tag => { setSearchType('tags'); setSearch(tag); setTab('explore'); setViewer(null); };
  const findHashtag = (text, q) => new RegExp(`(^|[^\\p{L}\\p{N}_])#${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'iu').test(text || '');

  async function musicFields(selected) {
    const mode = selected?.mode || 'none';
    if (mode === 'none') return {music_url:null,music_provider:null,music_title:null,music_artist:null,original_audio_path:null};
    if (mode === 'original') {
      if (!selected.file) throw Error('Choose your original audio file first.');
      if (!selected.title?.trim()) throw Error('Give your original audio a track title.');
      const path = await uploadOriginalAudio(me, selected.file);
      return {music_url:null,music_provider:'original',music_title:selected.title.trim(),music_artist:selected.artist?.trim()||username(mine),original_audio_path:path};
    }
    if (!selected.url?.trim() || providerFor(selected.url.trim()) !== mode) throw Error('Paste an official track URL for the selected music provider.');
    return {music_url:selected.url.trim(),music_provider:mode,music_title:selected.title?.trim()||null,music_artist:selected.artist?.trim()||null,original_audio_path:null};
  }

  async function publishPost() { await run(async () => {
    const music = await musicFields(postMusic);
    const path = await imagePath(photoUri);
    await table('posts', { author_id: me, image_path: path, caption: caption.trim(), ...music, location_label: locationOn ? (locationLabel.trim() || null) : null });
    setCaption(''); setPhotoUri(null); setPostMusic({mode:'none'}); setLocationLabel(''); setLocationOn(false); setTab('home');
    if (publishTo !== 'memento') Alert.alert('Saved to Memento', 'This post is saved on Memento. External sharing must be completed through the destination app; it was not automatically published there.');
  }); }
  async function saveStory(published) { await run(async () => {
    const music = await musicFields(storyMusic);
    const path = await imagePath(storyPhoto);
    await table('stories', { author_id: me, image_path: path, caption: storyCaption.trim(), published_at: published ? new Date().toISOString() : null, ...music, location_label: storyLocationOn ? (storyLocationLabel.trim() || null) : null });
    setStoryPhoto(null); setStoryCaption(''); setStoryMusic({mode:'none'}); setStoryLocationLabel(''); setStoryLocationOn(false); setTab('profile'); setSeenProfile(me);
    Alert.alert(published ? 'Story published' : 'Story archived', published ? 'Visible to signed-in members for 24 hours. Also saved in your private archive.' : 'Only you can see this until you publish it or add it to a public collection.');
  }); }
  async function follow(id) { await run(async () => {
    const old = follows.some(f => f.followed_id === id);
    const q = old ? supabase.from('follows').delete().eq('follower_id', me).eq('followed_id', id) : supabase.from('follows').insert({ follower_id: me, followed_id: id });
    const { error } = await q; if (error) throw error;
  }); }
  function startCollection(c = null) {
    setTab('editCollection');
    setEditor(c?.id || 'new'); setEditorTitle(c?.title || ''); setEditorVisibility(c?.visibility || 'private');
    setEditorCoverPath(c?.cover_path || null);
    setEditorStoryIds(c ? collectionItems.filter(x => x.collection_id === c.id).map(x => x.story_id) : []);
  }
  async function saveCollection() { await run(async () => {
    if (!editorTitle.trim()) throw Error('Give your collection a name.');
    if (!editorStoryIds.length) throw Error('Select at least one archived Story.');
    let id = editor;
    const fields = { title: editorTitle.trim(), visibility: editorVisibility, cover_path: editorCoverPath || archive.find(s => s.id === editorStoryIds[0])?.image_path || null };
    if (id === 'new') {
      const result = await table('collections', { ...fields, author_id: me, sort_order: collections.filter(c => c.author_id === me).length });
      id = result[0].id;
    } else {
      const { error } = await supabase.from('collections').update(fields).eq('id', id); if (error) throw error;
      const { error: delErr } = await supabase.from('collection_stories').delete().eq('collection_id', id); if (delErr) throw delErr;
    }
    await table('collection_stories', editorStoryIds.map((story_id, position) => ({ collection_id: id, story_id, position })));
    setEditor(null); setTab('profile');
  }); }
  async function moveCollection(c, offset) { await run(async () => {
    const items = collections.filter(x => x.author_id === me); const a = items.findIndex(x => x.id === c.id), b = a + offset;
    if (b < 0 || b >= items.length) return;
    // Use distinct intermediate indices to avoid unique-order collisions.
    const { error: e1 } = await supabase.from('collections').update({ sort_order: items[b].sort_order }).eq('id', items[a].id);
    const { error: e2 } = await supabase.from('collections').update({ sort_order: items[a].sort_order }).eq('id', items[b].id);
    if (e1 || e2) throw e1 || e2;
  }); }
  async function deleteCollection(id) { Alert.alert('Delete collection?', 'Archived Stories will remain saved.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run(async () => { const { error } = await supabase.from('collections').delete().eq('id', id); if (error) throw error; setEditor(null); }) }]); }
  async function deleteStory(id) { Alert.alert('Delete this Story?', 'This also removes it from collections.', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => run(async () => { const { error } = await supabase.from('stories').delete().eq('id', id); if (error) throw error; setViewer(null); }) }]); }
  async function editProfile() { await run(async () => {
    const handle = newUsername.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(handle)) throw Error('Username must be 3–24 lowercase letters, numbers or underscores.');
    const { error } = await supabase.from('profiles').update({ username: handle, bio: newBio.trim() }).eq('id', me);
    if (error) throw error; setProfileEdit(false); setTab('profile');
  }); }
  async function chooseCover() { try { const uri = await pickImage(); if (uri) await run(async () => setEditorCoverPath(await uploadImage(me, uri))); } catch (e) { message(e); } }
  const selectPhoto = async setter => {
    try {
      // Photo selection normally does not require full-library permission; iOS supports selected photos.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, allowsEditing: false });
      if (!result.canceled && result.assets?.[0]?.uri) setter(result.assets[0].uri);
    } catch (e) { Alert.alert('Photo picker', `${e?.message || e}\n\nIf blocked, open your device Settings → Memento (or Expo Go) → Photos.`); }
  };
  const askPhotoPermission = async () => {
    try {
      const result = await ImagePicker.requestMediaLibraryPermissionsAsync();
      Alert.alert('Photos', result.granted || result.accessPrivileges === 'limited' ? 'Photo access is available. You can now choose a picture.' : 'Photo access was not granted. You can change it in iPhone Settings → Expo Go or Memento → Photos.');
    } catch (e) { message(e); }
  };
  const useLocation = async setter => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return Alert.alert('Location off', 'You can type an optional city or place instead. Location is never added automatically.');
      const where = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const addresses = await Location.reverseGeocodeAsync(where.coords);
      const first = addresses[0];
      if (!first) return Alert.alert('Location', 'Could not identify your city. Type it manually instead.');
      setter([first.city || first.district, first.region].filter(Boolean).join(', '));
    } catch (e) { message(e); }
  };
  async function changePostArchive(post, archived) {
    if (post.author_id !== me) return;
    await run(async () => {
      const { error } = await supabase.from('posts').update({ archived }).eq('id', post.id).eq('author_id', me);
      if (error) throw error;
    });
  }
  function postOptions(post) {
    if (post.author_id !== me) return;
    Alert.alert('Post options', 'Choose what to do with this post.', [
      { text: post.archived ? 'Restore to profile' : 'Archive post', onPress: () => changePostArchive(post, !post.archived) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }
  async function likePost(postId) { await run(async () => {
    const liked = likes.some(l => l.post_id === postId && l.user_id === me);
    const { error } = liked ? await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', me) : await supabase.from('post_likes').insert({ post_id: postId, user_id: me });
    if (error) throw error;
  }); }
  async function addComment(postId) { if (!commentDraft.trim()) return; await run(async () => {
    const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: me, body: commentDraft.trim() });
    if (error) throw error; setCommentDraft('');
  }); }
  async function nativeRepost(post, asStory) { await run(async () => {
    if (!post.image_path) throw Error('This post has no reusable image.');
    if (asStory) {

      await table('stories', { author_id: me, image_path: post.image_path, caption: `Reposted from @${username(profiles.find(p => p.id === post.author_id))}: ${post.caption || ''}`.slice(0,2200), published_at: new Date().toISOString(), music_url: post.music_url || null, music_provider: post.music_provider || null, music_title: post.music_title || null, music_artist: post.music_artist || null, original_audio_path: post.original_audio_path || null, location_label: post.location_label || null });
    } else {

      await table('posts', { author_id: me, image_path: post.image_path, caption: `Reposted from @${username(profiles.find(p => p.id === post.author_id))}: ${post.caption || ''}`.slice(0,2200), repost_of: post.id, music_url: post.music_url || null, music_provider: post.music_provider || null, music_title: post.music_title || null, music_artist: post.music_artist || null, original_audio_path: post.original_audio_path || null, location_label: post.location_label || null });
    }
    setSharePost(null); Alert.alert('Shared', asStory ? 'Reposted to your Memento story.' : 'Reposted to your Memento page.');
  }); }
  async function externalShare(post, destination) {
    const author = username(profiles.find(p => p.id === post.author_id));
    const content = `Post by @${author} on Memento\n${post.caption || ''}${post.music_url ? `\n${post.music_url}` : ''}${post.music_title ? `\n♫ ${post.music_title} - ${post.music_artist || 'Original audio'}` : ''}`;
    try {
      if (destination === 'x') {
        await Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}`);
      } else {
        await Share.share({ message: `${content}\n${post.image_url || ''}`, title: 'Share to Instagram' });
      }
      setSharePost(null);
    } catch (e) { message(e); }
  }

  const owns = profileId === me;
  const followerCount = follows.filter(f => f.followed_id === profileId).length; // Only reflects loaded follows; use a count query for global counts.
  const myCollections = collections.filter(c => c.author_id === profileId && (owns || c.visibility === 'public'));
  const feed = posts.filter(p => !p.archived && (p.author_id === me || follows.some(f => f.followed_id === p.author_id)));
  const relevantStories = stories.filter(s => s.author_id === me || follows.some(f => f.followed_id === s.author_id));
  const currentCollection = collections.find(c => c.id === viewer?.collectionId);
  const selectedStories = viewer?.collectionId ? collectionItems.filter(x => x.collection_id === viewer.collectionId).map(x => [...archive, ...stories, ...sharedStories].find(s => s.id === x.story_id)).filter(Boolean) : [];
  const viewStory = viewer?.story || selectedStories[viewer?.index || 0];
  useEffect(() => { if (viewer) setTab('view'); }, [viewer]);

  if (!configured) return <SafeAreaView style={styles.safe}><View style={styles.auth}><Text style={styles.brand}>memento</Text><Text style={styles.title}>Backend setup needed</Text><Text style={styles.note}>Add your Supabase URL and publishable key to .env, then run the SQL in supabase/schema.sql. Follow README.md. Never use a secret or service-role key in the app.</Text></View></SafeAreaView>;
  if (booting) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={RED}/></SafeAreaView>;
  if (!session) return <Auth/>;

  const postCount = posts.filter(p => p.author_id === profileId && !p.archived).length;
  const followingCount = owns ? follows.length : null;
  const initial = username(profile).charAt(0).toUpperCase();

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor="#fff"/>
    <View style={styles.header}>
      <Text style={styles.brand}>memento<Text style={{color: RED}}>.</Text></Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <TouchableOpacity onPress={openActivity} accessibilityLabel="Activity notifications" style={styles.headerAction}><Text style={styles.headerRight}>♡{activity.some(n=>!n.read_at) ? '•' : ''}</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('inbox')} accessibilityLabel="Open direct messages" style={styles.headerAction}><Text style={styles.headerRight}>✉</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setTab('settings')} accessibilityLabel="Settings" style={styles.headerAction}><Text style={styles.headerRight}>⚙</Text></TouchableOpacity>
        <TouchableOpacity onPress={refresh} accessibilityLabel="Refresh feed" style={styles.headerAction}><Text style={styles.headerRight}>↻</Text></TouchableOpacity>
      </View>
    </View>
    <ScrollView key={tab + profileId} style={styles.screen} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={RED}/>} contentContainerStyle={{ paddingBottom: 108 }}>
      {tab === 'home' && <>
        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Stories</Text><Text style={styles.sectionHint}>LAST 24 HOURS</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesRow}>
          <TouchableOpacity onPress={() => setTab('story')} style={styles.storyChip}>
            <View style={[styles.storyBubble,styles.yourStory]}><Text style={styles.storyPlus}>+</Text></View><Text style={styles.storyLabel}>Your story</Text>
          </TouchableOpacity>
          {relevantStories.map(s => <TouchableOpacity key={s.id} onPress={() => setViewer({story:s})} style={styles.storyChip}><View style={styles.storyRing}><Photo uri={s.image_url} style={styles.storyPhoto}/></View><Text numberOfLines={1} style={styles.storyLabel}>{username(profiles.find(p => p.id === s.author_id))}</Text></TouchableOpacity>)}
        </ScrollView>
        {feed.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyIcon}>▧</Text><Text style={styles.emptyTitle}>Your feed starts here</Text><Text style={styles.emptyDescription}>Follow people in Explore or share your first photo to start making memories.</Text><TouchableOpacity style={styles.primaryPill} onPress={() => setTab('explore')}><Text style={styles.primaryPillText}>Find people</Text></TouchableOpacity></View>}
        {feed.map(p => <View key={p.id} style={styles.post}>
          <TouchableOpacity onPress={() => navigateProfile(p.author_id)} style={styles.postHeading}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{username(profiles.find(x => x.id === p.author_id)).charAt(0).toUpperCase()}</Text></View><Text style={styles.postHandle}>{username(profiles.find(x => x.id === p.author_id))}</Text>{p.author_id===me && <TouchableOpacity onPress={()=>postOptions(p)}><Text style={styles.postMore}>···</Text></TouchableOpacity>}</TouchableOpacity>
          <Photo uri={p.image_url} style={styles.postImage}/>
          <View style={styles.postActions}><TouchableOpacity onPress={() => likePost(p.id)} disabled={busy}><Text style={[styles.actionIcon,likes.some(l=>l.post_id===p.id&&l.user_id===me)&&{color:RED}]}>{likes.some(l=>l.post_id===p.id&&l.user_id===me)?'♥':'♡'}</Text></TouchableOpacity><TouchableOpacity onPress={() => {setCommenting(commenting===p.id?null:p.id);setCommentDraft('');}}><Text style={styles.actionIcon}>♧</Text></TouchableOpacity><TouchableOpacity onPress={() => setSharePost(p)}><Text style={styles.actionIcon}>↗</Text></TouchableOpacity><TouchableOpacity onPress={() => setSharePost(p)}><Text style={styles.actionIcon}>⇄</Text></TouchableOpacity></View>
          <Text style={styles.engagement}>{likes.filter(l => l.post_id === p.id).length} likes · {comments.filter(c => c.post_id === p.id).length} comments{p.repost_of ? ' · repost' : ''}</Text>
          {!!p.location_label && <Text style={styles.locationText}>⌖ {p.location_label}</Text>}
          <MusicDisplay item={p}/>
          <View style={styles.postCaptionRow}><Text style={styles.postHandle}>{username(profiles.find(x => x.id === p.author_id))} </Text><HashtagText onHashtag={searchTag} style={styles.caption}>{p.caption}</HashtagText></View>{commenting===p.id && <View style={styles.commentsBox}>{comments.filter(c=>c.post_id===p.id).map(c=><Text key={c.id} style={styles.commentLine}><Text style={{fontWeight:'800'}}>@{username(profiles.find(x=>x.id===c.author_id))} </Text>{c.body}</Text>)}<TextInput style={styles.commentField} placeholder="Write a comment..." value={commentDraft} onChangeText={setCommentDraft} maxLength={500} /><Button title="Post comment" onPress={()=>addComment(p.id)} disabled={!commentDraft.trim()||busy}/></View>}<Text style={styles.postDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
        </View>)}
      </>}
      {sharePost && <View style={styles.shareSheet}><Text style={styles.sectionTitle}>Share post</Text><Text style={styles.note}>Choose exactly where it goes. External sharing opens the destination or system share sheet; it does not silently publish.</Text><Mini onPress={()=>nativeRepost(sharePost,false)}>⇄ Repost to my Memento page</Mini><Mini onPress={()=>nativeRepost(sharePost,true)}>◌ Repost to my Memento story</Mini><Mini onPress={()=>externalShare(sharePost,'x')}>𝕏 Compose on X / Twitter</Mini><Mini onPress={()=>externalShare(sharePost,'instagram')}>◎ Open system share sheet for Instagram</Mini><Mini onPress={()=>setSharePost(null)}>Cancel</Mini></View>}
      {tab === 'settings' && <><Text style={styles.pageTitle}>Settings</Text><Text style={styles.pageSubtitle}>Your content, your choices.</Text>
        <Text style={styles.section}>Your posts</Text>
        <Text style={styles.note}>Everyone can publish posts and stories. To hide an individual post from your page, open its ••• menu and choose Archive post. Restore it anytime from your private Post archive on your profile.</Text>
        <Text style={styles.section}>Device access</Text>
        <Mini onPress={askPhotoPermission}>Request photo library permission</Mini>
        <Mini onPress={()=>useLocation(v=>Alert.alert('Current city',v))}>Request location only when I choose</Mini>
        <Mini onPress={()=>Linking.openSettings()}>Open device app settings</Mini>
        <Text style={styles.section}>Notifications</Text><Mini onPress={enablePush}>Enable iPhone / Android push alerts</Mini>{!!notificationError && <Text style={styles.note}>{notificationError}</Text>}<Text style={styles.note}>Activity appears inside Memento automatically. Lock-screen banners require a development/production build and deployed push delivery.</Text>
        <Text style={styles.section}>Connected platforms</Text>
        <Text style={styles.note}>Instagram and X OAuth connections require registered developer apps, redirect URIs and a secure token server. No external account is connected by this screen yet.</Text>
        <Text style={styles.section}>Music</Text><Text style={styles.note}>Attach Spotify, SoundCloud or Apple Music links to posts and stories. Playback happens in the music service; Memento does not rebroadcast copyrighted tracks.</Text>
      </>}
      {tab === 'activity' && <>
        <Text style={styles.pageTitle}>Activity</Text>
        <Text style={styles.pageSubtitle}>Messages, mentions, likes, comments, follows and reposts.</Text>
        {activity.length === 0 ? <View style={styles.dmEmpty}><Text style={styles.dmEmptyIcon}>♡</Text><Text style={styles.dmEmptyTitle}>No notifications yet</Text><Text style={styles.dmEmptyDescription}>When someone interacts with you, it will show up here.</Text></View> : activity.map(n => <TouchableOpacity key={n.id} style={[styles.personRow, !n.read_at && {backgroundColor:'#FFF3F5'}]} onPress={()=>openNotification(n)}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{username(profiles.find(p=>p.id===n.actor_id)).charAt(0).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.personName}>@{username(profiles.find(p=>p.id===n.actor_id))}</Text><Text style={styles.personBio}>{n.body}</Text><Text style={styles.tiny}>{new Date(n.created_at).toLocaleString()}</Text></View><Text style={styles.disclosure}>›</Text></TouchableOpacity>)}
      </>}
      {tab === 'inbox' && <>
        <Text style={styles.pageTitle}>{dmPerson ? `@${username(profiles.find(p=>p.id===dmPerson))}` : 'Messages'}</Text>
        {dmPerson ? <>
          <Mini onPress={()=>setDmPerson(null)}>← All messages</Mini>
          {directMessages.filter(m=>(m.sender_id===me&&m.recipient_id===dmPerson)||(m.sender_id===dmPerson&&m.recipient_id===me)).slice().reverse().map(m=><View key={m.id} style={[styles.dmMessage, m.sender_id===me && styles.dmMine]}><Text style={styles.dmText}>{m.body}</Text><Text style={styles.dmTime}>{new Date(m.created_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</Text></View>)}
          <TextInput style={styles.field} value={dmDraft} onChangeText={setDmDraft} placeholder="Write a message..." maxLength={2000} multiline/>
          <Button title="Send message" onPress={sendDM} disabled={!dmDraft.trim()||busy}/>
        </> : <>
          {directMessages.length===0 && <View style={styles.dmEmpty}><Text style={styles.dmEmptyIcon}>✉</Text><Text style={styles.dmEmptyTitle}>No messages yet</Text><Text style={styles.dmEmptyDescription}>Start a conversation with another Memento member.</Text></View>}
          {[...new Set(directMessages.map(m => m.sender_id===me?m.recipient_id:m.sender_id))].map(id=>{const latest=directMessages.find(m=>m.sender_id===id||m.recipient_id===id);return <TouchableOpacity key={id} style={styles.personRow} onPress={()=>setDmPerson(id)}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{username(profiles.find(p=>p.id===id)).charAt(0).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.personName}>@{username(profiles.find(p=>p.id===id))}</Text><Text style={styles.personBio} numberOfLines={1}>{latest?.body}</Text></View><Text style={styles.disclosure}>›</Text></TouchableOpacity>})}
          <Text style={styles.section}>Start a message</Text>
          {profiles.filter(p=>p.id!==me).map(p=><TouchableOpacity key={p.id} style={styles.personRow} onPress={()=>setDmPerson(p.id)}><Text style={styles.personName}>@{username(p)}</Text><Text style={styles.disclosure}>›</Text></TouchableOpacity>)}
        </>}
      </>}
      {tab === 'explore' && <>
        <Text style={styles.pageTitle}>Explore</Text><Text style={styles.pageSubtitle}>Find people and discover memories.</Text>
        <TextInput style={styles.field} value={search} onChangeText={setSearch} placeholder="Search people or #memories" placeholderTextColor="#A0A4AE" autoCapitalize="none"/>
        <View style={styles.segmentRow}><TouchableOpacity style={[styles.segment,searchType==='people' && styles.segmentActive]} onPress={()=>setSearchType('people')}><Text style={[styles.segmentText,searchType==='people' && styles.segmentTextActive]}>People</Text></TouchableOpacity><TouchableOpacity style={[styles.segment,searchType==='tags' && styles.segmentActive]} onPress={()=>{setSearchType('tags');setSearch(search.replace(/^#/,''));}}><Text style={[styles.segmentText,searchType==='tags' && styles.segmentTextActive]}>Hashtags</Text></TouchableOpacity></View>
        {searchType==='people' ? profiles.filter(x => (x.username || '').toLowerCase().includes(search.toLowerCase()) && x.id!==me).map(p => <TouchableOpacity key={p.id} style={styles.personRow} onPress={()=>navigateProfile(p.id)}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{username(p).charAt(0).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.personName}>@{username(p)}</Text><Text style={styles.personBio} numberOfLines={1}>{p.bio || 'Memento member'}</Text></View><Text style={styles.disclosure}>›</Text></TouchableOpacity>) : <>
          <Text style={styles.note}>Posts tagged #{search.replace(/^#/, '')}</Text>
          {posts.filter(p => !p.archived && search && findHashtag(p.caption,search.replace(/^#/,'').toLowerCase())).map(p=><TouchableOpacity key={p.id} style={styles.post} onPress={()=>navigateProfile(p.author_id)}><Photo uri={p.image_url} style={styles.postImage}/><HashtagText style={styles.caption} onHashtag={searchTag}>{p.caption}</HashtagText></TouchableOpacity>)}
        </>}
      </>}
      {tab === 'create' && <>
        <Text style={styles.pageTitle}>New post</Text><Text style={styles.pageSubtitle}>Share a moment worth keeping.</Text>
        <TouchableOpacity onPress={()=>selectPhoto(setPhotoUri)} style={styles.uploadCard}><Photo uri={photoUri} style={styles.uploadPreview}/>{!photoUri && <View style={styles.uploadOverlay}><Text style={styles.uploadIcon}>＋</Text><Text style={styles.uploadHeading}>Choose a photo</Text><Text style={styles.uploadHelp}>Tap to open your photo library</Text></View>}</TouchableOpacity>
        <TextInput value={caption} onChangeText={setCaption} style={[styles.field,styles.captionField]} placeholder="Write a caption... #memories" placeholderTextColor="#A0A4AE" multiline maxLength={2200}/>
        <MusicComposer value={postMusic} onChange={setPostMusic}/>
        <Mini onPress={()=>setLocationOn(!locationOn)}>{locationOn?'☑':'□'} Add a location to this post</Mini>
        {locationOn && <><TextInput style={styles.field} value={locationLabel} onChangeText={setLocationLabel} placeholder="Optional city/place (you control what appears)"/><Mini onPress={()=>useLocation(setLocationLabel)}>Use my current city (permission requested)</Mini></>}
        <Text style={styles.section}>Publish to</Text><View style={styles.choiceRow}><Mini onPress={()=>setPublishTo('memento')}>{publishTo==='memento'?'✓ ':''}Memento</Mini><Mini onPress={()=>setPublishTo('external')}>{publishTo==='external'?'✓ ':''}Memento + external share later</Mini></View>
        <Button title={busy ? 'Uploading…':'Share post'} disabled={busy || !photoUri} onPress={publishPost}/>
      </>}
      {tab === 'story' && <>
        <Text style={styles.pageTitle}>Your story</Text><Text style={styles.pageSubtitle}>Share for 24 hours or keep it in your private archive.</Text>
        <TouchableOpacity onPress={()=>selectPhoto(setStoryPhoto)} style={styles.uploadCard}><Photo uri={storyPhoto} style={styles.storyUploadPreview}/>{!storyPhoto && <View style={styles.uploadOverlay}><Text style={styles.uploadIcon}>＋</Text><Text style={styles.uploadHeading}>Add to your story</Text><Text style={styles.uploadHelp}>Choose a photo to get started</Text></View>}</TouchableOpacity>
        <TextInput style={styles.field} value={storyCaption} onChangeText={setStoryCaption} maxLength={2200} placeholder="Add a caption..." placeholderTextColor="#A0A4AE"/>
        <MusicComposer value={storyMusic} onChange={setStoryMusic}/>
        <Mini onPress={()=>setStoryLocationOn(!storyLocationOn)}>{storyLocationOn?'☑':'□'} Add optional story location</Mini>
        {storyLocationOn && <><TextInput style={styles.field} value={storyLocationLabel} onChangeText={setStoryLocationLabel} placeholder="Optional city/place"/><Mini onPress={()=>useLocation(setStoryLocationLabel)}>Use my current city (permission requested)</Mini></>}
        <Button title="Share to story · 24 hours" disabled={busy || !storyPhoto} onPress={()=>saveStory(true)}/>
        <Button title="Save to private archive" secondary disabled={busy || !storyPhoto} onPress={()=>saveStory(false)}/>
      </>}
      {tab==='profile' && <>
        <View style={styles.profileTop}><View style={styles.profileAvatar}><Text style={styles.profileInitial}>{initial}</Text></View><View style={styles.profileStats}><View style={styles.profileStat}><Text style={styles.profileStatNumber}>{postCount}</Text><Text style={styles.profileStatLabel}>posts</Text></View><View style={styles.profileStat}><Text style={styles.profileStatNumber}>{myCollections.length}</Text><Text style={styles.profileStatLabel}>collections</Text></View>{followingCount!==null && <View style={styles.profileStat}><Text style={styles.profileStatNumber}>{followingCount}</Text><Text style={styles.profileStatLabel}>following</Text></View>}</View></View>
        <View style={styles.profileIdentity}><Text style={styles.profileUsername}>@{username(profile)}</Text>{!!profile?.bio && <Text style={styles.profileBio}>{profile.bio}</Text>}</View>
        <View style={styles.profileButtons}>{owns ? <><TouchableOpacity style={styles.profileButton} onPress={()=>{setNewUsername(mine?.username||'');setNewBio(mine?.bio||'');setProfileEdit(true);setTab('editProfile');}}><Text style={styles.profileButtonText}>Edit profile</Text></TouchableOpacity><TouchableOpacity style={styles.profileButton} onPress={()=>supabase.auth.signOut()}><Text style={styles.profileButtonText}>Sign out</Text></TouchableOpacity></> : <TouchableOpacity style={styles.followButton} onPress={()=>follow(profileId)}><Text style={styles.followText}>{follows.some(f=>f.followed_id===profileId)?'Following ✓':'Follow'}</Text></TouchableOpacity>}</View>
        <View style={styles.divider}/>
        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Memory collections</Text>{owns && <TouchableOpacity onPress={()=>startCollection()}><Text style={styles.sectionLink}>+ New</Text></TouchableOpacity>}</View>
        {myCollections.length===0 && <TouchableOpacity onPress={()=>owns && startCollection()} style={styles.collectionEmpty}><Text style={styles.collectionEmptyIcon}>▢</Text><Text style={styles.collectionEmptyTitle}>No collections yet</Text><Text style={styles.collectionEmptyDescription}>{owns?'Save stories and organize them into collections.':'Collections will appear here.'}</Text></TouchableOpacity>}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionsRow}>{myCollections.map(c=><View key={c.id} style={styles.collectionItem}><TouchableOpacity onPress={()=>setViewer({collectionId:c.id,index:0})}><Photo uri={c.cover_url} style={styles.album}/><Text style={styles.albumTitle} numberOfLines={1}>{c.title}</Text><Text style={styles.albumMeta}>{c.visibility} · {collectionItems.filter(x=>x.collection_id===c.id).length} stories</Text></TouchableOpacity>{owns && <View style={styles.collectionControls}><Text style={styles.collectionEdit} onPress={()=>moveCollection(c,-1)}>←</Text><Text style={styles.collectionEdit} onPress={()=>startCollection(c)}>Edit</Text><Text style={styles.collectionEdit} onPress={()=>moveCollection(c,1)}>→</Text></View>}</View>)}</ScrollView>
        {owns && <><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Story archive</Text><Text style={styles.sectionHint}>PRIVATE</Text></View>{archive.length===0?<Text style={styles.emptyInline}>Your saved stories will appear here.</Text>:<View style={styles.grid}>{archive.map(s=><TouchableOpacity key={s.id} style={styles.tile} onPress={()=>setViewer({story:s,own:true})}><Photo uri={s.image_url} style={styles.tileImage}/></TouchableOpacity>)}</View>}</>}
        {owns && <><View style={styles.sectionRow}><Text style={styles.sectionTitle}>Post archive</Text><Text style={styles.sectionHint}>ONLY YOU</Text></View>{posts.filter(p=>p.author_id===me && p.archived).length===0?<Text style={styles.emptyInline}>No archived posts.</Text>:<View style={styles.grid}>{posts.filter(p=>p.author_id===me && p.archived).map(p=><TouchableOpacity key={p.id} style={styles.tile} onPress={()=>postOptions(p)}><Photo uri={p.image_url} style={styles.tileImage}/><Text style={styles.tiny}>Tap to restore</Text></TouchableOpacity>)}</View>}</>}
        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Posts</Text><Text style={styles.sectionHint}>{postCount} TOTAL</Text></View>{postCount===0?<Text style={styles.emptyInline}>No posts yet.</Text>:<View style={styles.grid}>{posts.filter(p=>p.author_id===profileId && !p.archived).map(p=><TouchableOpacity key={p.id} style={styles.tile} onPress={()=>postOptions(p)} disabled={!owns}><Photo uri={p.image_url} style={styles.tileImage}/></TouchableOpacity>)}</View>}
      </>}
      {tab === 'editCollection' && editor && <>
        <Text style={styles.pageTitle}>{editor==='new'?'New memory collection':'Edit memory collection'}</Text>
        <TextInput style={styles.field} value={editorTitle} onChangeText={setEditorTitle} maxLength={48} placeholder="Collection name"/>
        <Text style={styles.section}>Visibility</Text><View style={styles.row}><Button secondary title={editorVisibility==='private'?'✓ Private':'Private'} onPress={()=>setEditorVisibility('private')}/><Button secondary title={editorVisibility==='public'?'✓ Public':'Public'} onPress={()=>setEditorVisibility('public')}/></View>
        <Text style={styles.note}>Public collections can show archived stories you add to them to other Memento members.</Text>
        <Text style={styles.section}>Cover</Text><Text style={styles.action} onPress={chooseCover}>Choose custom photo cover</Text>
        <Text style={styles.section}>Select archived stories · {editorStoryIds.length} selected</Text><View style={styles.grid}>{archive.map(s=><TouchableOpacity key={s.id} style={styles.tile} onPress={()=>{setEditorStoryIds(old=>old.includes(s.id)?old.filter(id=>id!==s.id):[...old,s.id]);if(!editorCoverPath)setEditorCoverPath(s.image_path);}}><Photo uri={s.image_url} style={[styles.tileImage,editorStoryIds.includes(s.id)&&{borderWidth:4,borderColor:RED}]}/><Text style={styles.tiny}>{editorStoryIds.includes(s.id)?'✓ Selected':'Tap to add'}</Text><Text style={styles.action} onPress={()=>setEditorCoverPath(s.image_path)}>Use as cover</Text></TouchableOpacity>)}</View>
        <Button title={busy?'Saving…':'Save collection'} disabled={busy} onPress={saveCollection}/>{editor!=='new'&&<Button secondary title="Delete collection" onPress={()=>deleteCollection(editor)}/>}<Button secondary title="Cancel" onPress={()=>{setEditor(null);setTab('profile');}}/>
      </>}
      {tab==='view' && viewer && <><Text style={styles.pageTitle}>{currentCollection?.title||'Story'}</Text><Photo uri={viewStory?.image_url} style={styles.storyPicker}/>{!!viewStory?.location_label && <Text style={styles.locationText}>⌖ {viewStory.location_label}</Text>}<MusicDisplay item={viewStory}/><HashtagText style={styles.caption} onHashtag={searchTag}>{viewStory?.caption}</HashtagText>{currentCollection&&<><Text style={styles.note}>{(viewer.index||0)+1} / {selectedStories.length}</Text><View style={styles.row}><Button secondary title="← Previous" onPress={()=>setViewer({...viewer,index:Math.max(0,(viewer.index||0)-1)})}/><Button secondary title="Next →" onPress={()=>setViewer({...viewer,index:Math.min(selectedStories.length-1,(viewer.index||0)+1)})}/></View><Button secondary title="Share collection" onPress={()=>Share.share({message:`See my ${currentCollection.title} collection on Memento!`,title:currentCollection.title})}/></>}{viewer.own&&<Button secondary title="Delete story" onPress={()=>deleteStory(viewStory.id)}/>}<Button title="Close" onPress={()=>{setViewer(null);setTab('profile');}}/></>}
      {tab==='editProfile' && profileEdit && <><Text style={styles.pageTitle}>Edit profile</Text><TextInput value={newUsername} onChangeText={setNewUsername} style={styles.field} autoCapitalize="none" placeholder="Username"/><TextInput value={newBio} onChangeText={setNewBio} multiline maxLength={300} style={styles.field} placeholder="Bio"/><Button title="Save profile" onPress={editProfile}/><Button secondary title="Cancel" onPress={()=>setTab('profile')}/></>}
    </ScrollView>
    <View style={styles.nav}>{[['home','⌂','Home'],['explore','⌕','Explore'],['create','＋','Create'],['story','◌','Story'],['profile','◉','Profile']].map(([name,symbol,label])=><TouchableOpacity key={name} onPress={()=>{setTab(name);if(name==='profile')setSeenProfile(me);}} style={styles.navItem}><Text style={[styles.navIcon,tab===name&&styles.navIconActive]}>{symbol}</Text><Text style={[styles.navLabel,tab===name&&styles.navLabelActive]}>{label}</Text></TouchableOpacity>)}</View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFFFFF'},center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#fff'},screen:{flex:1},
  auth:{flex:1,justifyContent:'center',padding:26,gap:12},brand:{fontSize:30,fontWeight:'900',letterSpacing:-1.6,color:'#17191F'},subheading:{color:'#858A95',marginBottom:18},
  header:{height:65,paddingHorizontal:20,borderBottomWidth:1,borderColor:'#F1F1F4',flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'#fff'},headerAction:{padding:8},headerRight:{fontSize:28,color:'#242830'},
  pageTitle:{fontSize:29,fontWeight:'800',letterSpacing:-1.0,color:'#17191F',marginHorizontal:20,marginTop:25},pageSubtitle:{fontSize:14,color:'#858B98',lineHeight:21,marginHorizontal:20,marginTop:5,marginBottom:22},
  section:{fontSize:17,fontWeight:'750',marginHorizontal:20,marginTop:23,marginBottom:12,color:'#20242B'},sectionRow:{marginHorizontal:20,marginTop:24,marginBottom:15,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},sectionTitle:{fontSize:18,fontWeight:'800',color:'#20242B',letterSpacing:-.3},sectionHint:{fontSize:10,fontWeight:'700',letterSpacing:1.1,color:'#A2A6B1'},sectionLink:{fontSize:14,fontWeight:'800',color:RED},
  note:{color:'#858B98',fontSize:13,marginHorizontal:20,marginVertical:10,lineHeight:20},field:{marginHorizontal:20,marginVertical:8,padding:15,borderRadius:13,backgroundColor:'#F4F5F7',minHeight:52,fontSize:15,color:'#252933'},captionField:{minHeight:100,textAlignVertical:'top'},
  button:{backgroundColor:RED,borderRadius:13,padding:16,marginHorizontal:20,marginVertical:6,alignItems:'center',justifyContent:'center',flexShrink:1},buttonText:{color:'#fff',fontWeight:'800',fontSize:14,textAlign:'center'},secondary:{backgroundColor:'#F1F2F5'},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-around',gap:6,marginVertical:8},
  storiesRow:{paddingHorizontal:19,paddingBottom:19,gap:13},storyChip:{width:76,alignItems:'center'},storyBubble:{width:67,height:67,borderRadius:34,alignItems:'center',justifyContent:'center'},yourStory:{backgroundColor:'#F4F5F7',borderWidth:1.5,borderColor:'#D7DBE3',borderStyle:'dashed'},storyPlus:{fontSize:33,color:'#1A1C23',fontWeight:'400',marginTop:-4},storyRing:{width:67,height:67,borderRadius:34,borderWidth:2.5,borderColor:RED,padding:3},storyPhoto:{width:'100%',height:'100%',borderRadius:32},storyLabel:{fontSize:11.5,color:'#434852',marginTop:8,textAlign:'center'},
  emptyState:{alignItems:'center',paddingHorizontal:38,paddingVertical:55,borderTopWidth:1,borderColor:'#F0F0F3'},emptyIcon:{fontSize:46,color:'#BEC3CE',marginBottom:13},emptyTitle:{fontSize:19,fontWeight:'800',color:'#252933'},emptyDescription:{fontSize:13.5,color:'#9297A3',lineHeight:21,textAlign:'center',marginTop:9,marginBottom:24},primaryPill:{backgroundColor:RED,borderRadius:24,paddingVertical:13,paddingHorizontal:25},primaryPillText:{color:'#fff',fontSize:13,fontWeight:'800'},
  post:{paddingBottom:22,borderTopWidth:1,borderColor:'#F2F2F5',marginBottom:9},postHeading:{height:64,paddingHorizontal:16,flexDirection:'row',alignItems:'center',gap:10},smallAvatar:{width:38,height:38,borderRadius:19,backgroundColor:'#EDEEF3',alignItems:'center',justifyContent:'center'},smallAvatarText:{fontWeight:'800',color:'#4B5362',fontSize:16},postHandle:{fontWeight:'800',fontSize:13.5,color:'#252933'},postMore:{marginLeft:'auto',fontSize:24,fontWeight:'700',color:'#8B90A0'},postImage:{width:'100%',aspectRatio:1,backgroundColor:'#E8E5E1'},postActions:{flexDirection:'row',gap:18,paddingHorizontal:17,paddingTop:10},actionIcon:{fontSize:28,color:'#282C36'},postCaptionRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'baseline',marginHorizontal:17,marginTop:7},caption:{fontSize:13.5,lineHeight:21,color:'#343942'},postDate:{fontSize:10.5,color:'#A0A5AF',marginHorizontal:17,marginTop:6},
  segmentRow:{flexDirection:'row',backgroundColor:'#F4F5F7',marginHorizontal:20,marginTop:11,marginBottom:15,borderRadius:12,padding:4},segment:{flex:1,paddingVertical:11,alignItems:'center',borderRadius:9},segmentActive:{backgroundColor:'#fff'},segmentText:{fontWeight:'700',fontSize:13,color:'#858B98'},segmentTextActive:{color:'#17191F'},personRow:{flexDirection:'row',alignItems:'center',gap:12,paddingHorizontal:20,paddingVertical:13,borderBottomWidth:1,borderColor:'#F3F3F5'},personName:{fontSize:14,fontWeight:'800',color:'#262A31'},personBio:{fontSize:12,color:'#9096A3',marginTop:3},disclosure:{fontSize:28,color:'#A9AFBA'},
  uploadCard:{marginHorizontal:20,marginVertical:8,borderRadius:18,overflow:'hidden',backgroundColor:'#F2F3F6'},uploadPreview:{height:300,width:'100%'},storyUploadPreview:{height:370,width:'100%'},uploadOverlay:{position:'absolute',top:0,bottom:0,left:0,right:0,alignItems:'center',justifyContent:'center'},uploadIcon:{fontSize:44,color:RED},uploadHeading:{fontWeight:'800',fontSize:17,color:'#31353E',marginTop:6},uploadHelp:{fontSize:12,color:'#9298A3',marginTop:8},
  profileTop:{flexDirection:'row',alignItems:'center',paddingHorizontal:21,paddingTop:28,gap:24},profileAvatar:{width:86,height:86,borderRadius:43,backgroundColor:'#F2E8EB',alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:'#F5C1CB'},profileInitial:{fontSize:39,fontWeight:'800',color:RED},profileStats:{flex:1,flexDirection:'row',justifyContent:'space-around'},profileStat:{alignItems:'center',minWidth:60},profileStatNumber:{fontSize:19,fontWeight:'850',color:'#1E2027'},profileStatLabel:{fontSize:11,color:'#8B909C',marginTop:5},profileIdentity:{marginHorizontal:22,marginTop:19},profileUsername:{fontWeight:'850',fontSize:19,letterSpacing:-.4,color:'#17191F'},profileBio:{fontSize:13.5,lineHeight:20,color:'#565D69',marginTop:7},profileButtons:{flexDirection:'row',gap:9,paddingHorizontal:20,marginTop:20,marginBottom:4},profileButton:{flex:1,backgroundColor:'#F0F1F4',borderRadius:10,alignItems:'center',paddingVertical:12},profileButtonText:{fontSize:13,fontWeight:'800',color:'#292E38'},followButton:{backgroundColor:RED,flex:1,borderRadius:10,alignItems:'center',paddingVertical:12},followText:{color:'#fff',fontWeight:'800',fontSize:13},divider:{height:1,backgroundColor:'#F0F1F4',marginTop:23},
  collectionEmpty:{marginHorizontal:20,backgroundColor:'#FAFAFB',borderRadius:15,paddingVertical:27,paddingHorizontal:18,alignItems:'center',borderWidth:1,borderColor:'#F2F2F5'},collectionEmptyIcon:{fontSize:30,color:'#A9AFBB'},collectionEmptyTitle:{fontSize:14,fontWeight:'800',color:'#373B44',marginTop:8},collectionEmptyDescription:{fontSize:12,color:'#9298A3',textAlign:'center',marginTop:5},collectionsRow:{paddingHorizontal:20,gap:13},collectionItem:{width:144},album:{height:166,width:144,borderRadius:13},albumTitle:{fontWeight:'800',fontSize:13.5,color:'#262B34',marginTop:8},albumMeta:{fontSize:10.5,color:'#989EAA',marginTop:4},collectionControls:{flexDirection:'row',justifyContent:'space-between',marginTop:8},collectionEdit:{fontSize:12,color:RED,fontWeight:'700'},
  emptyInline:{fontSize:13,color:'#A0A5B0',marginHorizontal:21,marginBottom:18,marginTop:4},grid:{flexDirection:'row',flexWrap:'wrap',paddingHorizontal:1,gap:2},tile:{width:'33%',aspectRatio:1},tileImage:{width:'100%',height:'100%'},
  tiny:{fontSize:11,color:'#8C929E',marginTop:5,textAlign:'center'},action:{fontSize:13,color:RED,marginHorizontal:20,marginVertical:10,fontWeight:'800'},storyPicker:{height:420,margin:20,borderRadius:14},
  dmMessage:{alignSelf:'flex-start',maxWidth:'85%',backgroundColor:'#F1F2F5',marginHorizontal:20,marginVertical:5,padding:14,borderRadius:17},dmMine:{alignSelf:'flex-end',backgroundColor:'#FFE0E5'},dmText:{fontSize:14,color:'#242933'},dmTime:{fontSize:10,color:'#858B98',marginTop:6},
  dmEmpty:{alignItems:'center',paddingHorizontal:35,paddingTop:90},dmEmptyIcon:{fontSize:45,color:'#B8BDC7'},dmEmptyTitle:{fontSize:18,fontWeight:'800',color:'#252933',marginTop:15},dmEmptyDescription:{fontSize:13,color:'#9297A3',lineHeight:20,textAlign:'center',marginTop:8},
  miniAction:{marginHorizontal:20,marginVertical:5,paddingVertical:13,paddingHorizontal:14,borderRadius:12,backgroundColor:'#F4F5F7'},miniActionText:{fontSize:13,fontWeight:'700',color:'#2D3340'},shareSheet:{backgroundColor:'#fff6f8',borderWidth:1,borderColor:'#F3BEC7',borderRadius:15,margin:12,padding:10},engagement:{fontSize:12,fontWeight:'800',marginHorizontal:17,marginTop:9,color:'#363B44'},locationText:{fontSize:12,color:'#626A78',marginHorizontal:17,marginTop:8},musicLink:{fontSize:13,color:RED,marginHorizontal:17,marginTop:9,fontWeight:'700'},commentsBox:{paddingVertical:10},commentLine:{marginHorizontal:20,fontSize:13,lineHeight:20,marginVertical:3,color:'#30333A'},commentField:{marginHorizontal:20,borderWidth:1,borderColor:'#DDD',borderRadius:9,padding:11,marginTop:10},choiceRow:{flexDirection:'row',flexWrap:'wrap',alignItems:'center'},
  musicComposer:{marginTop:12,marginBottom:15,paddingTop:8},musicSectionTitle:{fontSize:16,fontWeight:'800',marginHorizontal:20,marginBottom:9,color:'#303540'},musicChoices:{flexDirection:'row',flexWrap:'wrap',gap:7,marginHorizontal:20,marginBottom:8},musicChoice:{paddingVertical:9,paddingHorizontal:11,backgroundColor:'#F2F3F6',borderRadius:11},musicChoiceActive:{backgroundColor:'#E4384F'},musicChoiceText:{fontSize:12,fontWeight:'700',color:'#363A44'},musicChoiceTextActive:{color:'#FFFFFF'},musicHint:{fontSize:12,lineHeight:18,marginHorizontal:20,marginVertical:6,color:'#7A7F89'},musicCard:{padding:12,marginHorizontal:17,marginTop:8,backgroundColor:'#F5F5F8',borderRadius:13},musicCardTitle:{fontSize:13,fontWeight:'800',color:'#242933'},musicCardArtist:{fontSize:12,color:'#6A7180',marginTop:3},audioPlayButton:{backgroundColor:'#E9EAF0',padding:10,borderRadius:10,marginTop:8},audioPlayText:{fontSize:12,fontWeight:'700',color:'#272D38'},
  nav:{backgroundColor:'#fff',borderTopWidth:1,borderColor:'#ECEEF1',flexDirection:'row',paddingTop:10,paddingBottom:7},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIcon:{fontSize:29,color:'#2B303A',height:36},navIconActive:{color:RED},navLabel:{fontSize:10,color:'#959AA5',marginTop:2,fontWeight:'600'},navLabelActive:{color:RED,fontWeight:'800'}
});
