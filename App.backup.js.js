import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, RefreshControl, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { configured, supabase } from './lib/supabase';
import { pickImage, uploadImage, signedImage } from './lib/media';
import { HashtagText } from './lib/hashtags';

const RED = '#E4384F';
const Button = ({ title, onPress, secondary, disabled }) => <TouchableOpacity disabled={disabled} onPress={onPress} style={[styles.button, secondary && styles.secondary, disabled && { opacity: .5 }]}><Text style={[styles.buttonText, secondary && { color: '#202020' }]}>{title}</Text></TouchableOpacity>;
const Photo = ({ uri, style }) => uri ? <Image source={{ uri }} style={style} /> : <View style={[style, { backgroundColor: '#e8e5e1' }]} />;
const username = p => p?.username || 'member';
const message = e => Alert.alert('Memento', e?.message || String(e));

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
  const [likedPosts, setLikedPosts] = useState({}); // UI-only likes; add a likes table for persistent social likes.
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
      ]);
      const err = results.find(r => r.error)?.error; if (err) throw err;
      setProfiles(results[0].data); setFollows(results[1].data);
      setPosts(await hydrateImages(results[2].data));
      setStories(await hydrateImages(results[3].data));
      setArchive(await hydrateImages(results[4].data));
      setCollections(await hydrateImages(results[5].data));
      setCollectionItems(results[6].data);
      const storyIds = [...new Set(results[6].data.map(x => x.story_id))];
      if (storyIds.length) {
        const { data: allowed, error: shareError } = await supabase.from('stories').select('*').in('id', storyIds);
        if (shareError) throw shareError;
        setSharedStories(await hydrateImages(allowed));
      } else setSharedStories([]);
    } catch (e) { message(e); }
  }, [me]);
  useEffect(() => { if (me) load(); else { setPosts([]); setArchive([]); setCollections([]); setSeenProfile(null); } }, [me, load]);
  useEffect(() => { if (!me) return; const timer = setInterval(load, 60000); return () => clearInterval(timer); }, [me, load]);
  async function refresh() { setRefreshing(true); await load(); setRefreshing(false); }
  async function run(task) { if (busy) return; setBusy(true); try { await task(); await load(); } catch (e) { message(e); } finally { setBusy(false); } }
  const table = async (name, values) => { const { data, error } = await supabase.from(name).insert(values).select(); if (error) throw error; return data; };
  const imagePath = async uri => { if (!uri) throw Error('Choose a photo first.'); return uploadImage(me, uri); };
  const navigateProfile = id => { setSeenProfile(id); setTab('profile'); setViewer(null); };
  const searchTag = tag => { setSearchType('tags'); setSearch(tag); setTab('explore'); setViewer(null); };
  const findHashtag = (text, q) => new RegExp(`(^|[^\\p{L}\\p{N}_])#${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'iu').test(text || '');

  async function publishPost() { await run(async () => {
    const path = await imagePath(photoUri);
    await table('posts', { author_id: me, image_path: path, caption: caption.trim() });
    setCaption(''); setPhotoUri(null); setTab('home');
  }); }
  async function saveStory(published) { await run(async () => {
    const path = await imagePath(storyPhoto);
    await table('stories', { author_id: me, image_path: path, caption: storyCaption.trim(), published_at: published ? new Date().toISOString() : null });
    setStoryPhoto(null); setStoryCaption(''); setTab('profile'); setSeenProfile(me);
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
  const selectPhoto = async setter => { try { const uri = await pickImage(); if (uri) setter(uri); } catch (e) { message(e); } };
  const owns = profileId === me;
  const followerCount = follows.filter(f => f.followed_id === profileId).length; // Only reflects loaded follows; use a count query for global counts.
  const myCollections = collections.filter(c => c.author_id === profileId && (owns || c.visibility === 'public'));
  const feed = posts.filter(p => p.author_id === me || follows.some(f => f.followed_id === p.author_id));
  const relevantStories = stories.filter(s => s.author_id === me || follows.some(f => f.followed_id === s.author_id));
  const currentCollection = collections.find(c => c.id === viewer?.collectionId);
  const selectedStories = viewer?.collectionId ? collectionItems.filter(x => x.collection_id === viewer.collectionId).map(x => [...archive, ...stories, ...sharedStories].find(s => s.id === x.story_id)).filter(Boolean) : [];
  const viewStory = viewer?.story || selectedStories[viewer?.index || 0];
  useEffect(() => { if (viewer) setTab('view'); }, [viewer]);

  if (!configured) return <SafeAreaView style={styles.safe}><View style={styles.auth}><Text style={styles.brand}>memento</Text><Text style={styles.title}>Backend setup needed</Text><Text style={styles.note}>Add your Supabase URL and publishable key to .env, then run the SQL in supabase/schema.sql. Follow README.md. Never use a secret or service-role key in the app.</Text></View></SafeAreaView>;
  if (booting) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={RED}/></SafeAreaView>;
  if (!session) return <Auth/>;

  const postCount = posts.filter(p => p.author_id === profileId).length;
  const followingCount = owns ? follows.length : null;
  const initial = username(profile).charAt(0).toUpperCase();

  return <SafeAreaView style={styles.safe}><StatusBar barStyle="dark-content" backgroundColor="#fff"/>
    <View style={styles.header}>
      <Text style={styles.brand}>memento<Text style={{color: RED}}>.</Text></Text>
      <View style={{flexDirection:'row',alignItems:'center',gap:12}}>
        <TouchableOpacity onPress={() => setTab('inbox')} accessibilityLabel="Open direct messages" style={styles.headerAction}><Text style={styles.headerRight}>✉</Text></TouchableOpacity>
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
          <TouchableOpacity onPress={() => navigateProfile(p.author_id)} style={styles.postHeading}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{username(profiles.find(x => x.id === p.author_id)).charAt(0).toUpperCase()}</Text></View><Text style={styles.postHandle}>{username(profiles.find(x => x.id === p.author_id))}</Text><Text style={styles.postMore}>···</Text></TouchableOpacity>
          <Photo uri={p.image_url} style={styles.postImage}/>
          <View style={styles.postActions}><TouchableOpacity onPress={() => setLikedPosts(old => ({...old,[p.id]: !old[p.id]}))}><Text style={[styles.actionIcon, likedPosts[p.id] && {color:RED}]}>{likedPosts[p.id] ? '♥' : '♡'}</Text></TouchableOpacity><TouchableOpacity onPress={() => Share.share({message: `Check out this post by @${username(profiles.find(x => x.id === p.author_id))} on Memento.`})}><Text style={styles.actionIcon}>↗</Text></TouchableOpacity></View>
          <View style={styles.postCaptionRow}><Text style={styles.postHandle}>{username(profiles.find(x => x.id === p.author_id))} </Text><HashtagText onHashtag={searchTag} style={styles.caption}>{p.caption}</HashtagText></View><Text style={styles.postDate}>{new Date(p.created_at).toLocaleDateString()}</Text>
        </View>)}
      </>}
      {tab === 'inbox' && <>
        <Text style={styles.pageTitle}>Messages</Text>
        <View style={styles.dmEmpty}>
          <Text style={styles.dmEmptyIcon}>✉</Text>
          <Text style={styles.dmEmptyTitle}>No messages yet</Text>
          <Text style={styles.dmEmptyDescription}>Your conversations will show up here once direct messaging is available.</Text>
        </View>
      </>}
      {tab === 'explore' && <>
        <Text style={styles.pageTitle}>Explore</Text><Text style={styles.pageSubtitle}>Find people and discover memories.</Text>
        <TextInput style={styles.field} value={search} onChangeText={setSearch} placeholder="Search people or #memories" placeholderTextColor="#A0A4AE" autoCapitalize="none"/>
        <View style={styles.segmentRow}><TouchableOpacity style={[styles.segment,searchType==='people' && styles.segmentActive]} onPress={()=>setSearchType('people')}><Text style={[styles.segmentText,searchType==='people' && styles.segmentTextActive]}>People</Text></TouchableOpacity><TouchableOpacity style={[styles.segment,searchType==='tags' && styles.segmentActive]} onPress={()=>{setSearchType('tags');setSearch(search.replace(/^#/,''));}}><Text style={[styles.segmentText,searchType==='tags' && styles.segmentTextActive]}>Hashtags</Text></TouchableOpacity></View>
        {searchType==='people' ? profiles.filter(x => (x.username || '').toLowerCase().includes(search.toLowerCase()) && x.id!==me).map(p => <TouchableOpacity key={p.id} style={styles.personRow} onPress={()=>navigateProfile(p.id)}><View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{username(p).charAt(0).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.personName}>@{username(p)}</Text><Text style={styles.personBio} numberOfLines={1}>{p.bio || 'Memento member'}</Text></View><Text style={styles.disclosure}>›</Text></TouchableOpacity>) : <>
          <Text style={styles.note}>Posts tagged #{search.replace(/^#/, '')}</Text>
          {posts.filter(p => search && findHashtag(p.caption,search.replace(/^#/,'').toLowerCase())).map(p=><TouchableOpacity key={p.id} style={styles.post} onPress={()=>navigateProfile(p.author_id)}><Photo uri={p.image_url} style={styles.postImage}/><HashtagText style={styles.caption} onHashtag={searchTag}>{p.caption}</HashtagText></TouchableOpacity>)}
        </>}
      </>}
      {tab === 'create' && <>
        <Text style={styles.pageTitle}>New post</Text><Text style={styles.pageSubtitle}>Share a moment worth keeping.</Text>
        <TouchableOpacity onPress={()=>selectPhoto(setPhotoUri)} style={styles.uploadCard}><Photo uri={photoUri} style={styles.uploadPreview}/>{!photoUri && <View style={styles.uploadOverlay}><Text style={styles.uploadIcon}>＋</Text><Text style={styles.uploadHeading}>Choose a photo</Text><Text style={styles.uploadHelp}>Tap to open your photo library</Text></View>}</TouchableOpacity>
        <TextInput value={caption} onChangeText={setCaption} style={[styles.field,styles.captionField]} placeholder="Write a caption... #memories" placeholderTextColor="#A0A4AE" multiline maxLength={2200}/>
        <Button title={busy ? 'Uploading…':'Share post'} disabled={busy || !photoUri} onPress={publishPost}/>
      </>}
      {tab === 'story' && <>
        <Text style={styles.pageTitle}>Your story</Text><Text style={styles.pageSubtitle}>Share for 24 hours or keep it in your private archive.</Text>
        <TouchableOpacity onPress={()=>selectPhoto(setStoryPhoto)} style={styles.uploadCard}><Photo uri={storyPhoto} style={styles.storyUploadPreview}/>{!storyPhoto && <View style={styles.uploadOverlay}><Text style={styles.uploadIcon}>＋</Text><Text style={styles.uploadHeading}>Add to your story</Text><Text style={styles.uploadHelp}>Choose a photo to get started</Text></View>}</TouchableOpacity>
        <TextInput style={styles.field} value={storyCaption} onChangeText={setStoryCaption} maxLength={2200} placeholder="Add a caption..." placeholderTextColor="#A0A4AE"/>
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
        <View style={styles.sectionRow}><Text style={styles.sectionTitle}>Posts</Text><Text style={styles.sectionHint}>{postCount} TOTAL</Text></View>{postCount===0?<Text style={styles.emptyInline}>No posts yet.</Text>:<View style={styles.grid}>{posts.filter(p=>p.author_id===profileId).map(p=><View key={p.id} style={styles.tile}><Photo uri={p.image_url} style={styles.tileImage}/></View>)}</View>}
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
      {tab==='view' && viewer && <><Text style={styles.pageTitle}>{currentCollection?.title||'Story'}</Text><Photo uri={viewStory?.image_url} style={styles.storyPicker}/><HashtagText style={styles.caption} onHashtag={searchTag}>{viewStory?.caption}</HashtagText>{currentCollection&&<><Text style={styles.note}>{(viewer.index||0)+1} / {selectedStories.length}</Text><View style={styles.row}><Button secondary title="← Previous" onPress={()=>setViewer({...viewer,index:Math.max(0,(viewer.index||0)-1)})}/><Button secondary title="Next →" onPress={()=>setViewer({...viewer,index:Math.min(selectedStories.length-1,(viewer.index||0)+1)})}/></View><Button secondary title="Share collection" onPress={()=>Share.share({message:`See my ${currentCollection.title} collection on Memento!`,title:currentCollection.title})}/></>}{viewer.own&&<Button secondary title="Delete story" onPress={()=>deleteStory(viewStory.id)}/>}<Button title="Close" onPress={()=>{setViewer(null);setTab('profile');}}/></>}
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
  dmEmpty:{alignItems:'center',paddingHorizontal:35,paddingTop:90},dmEmptyIcon:{fontSize:45,color:'#B8BDC7'},dmEmptyTitle:{fontSize:18,fontWeight:'800',color:'#252933',marginTop:15},dmEmptyDescription:{fontSize:13,color:'#9297A3',lineHeight:20,textAlign:'center',marginTop:8},
  nav:{backgroundColor:'#fff',borderTopWidth:1,borderColor:'#ECEEF1',flexDirection:'row',paddingTop:10,paddingBottom:7},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIcon:{fontSize:29,color:'#2B303A',height:36},navIconActive:{color:RED},navLabel:{fontSize:10,color:'#959AA5',marginTop:2,fontWeight:'600'},navLabelActive:{color:RED,fontWeight:'800'}
});
