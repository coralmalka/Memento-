// Memento original audio + official music search/link utilities.
// Linked Spotify/Apple Music/SoundCloud tracks are never copied or rehosted.
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { supabase } from './supabase';

const AUDIO_BUCKET = 'original-audio';
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

const domainOf = input => {
  try {
    const url = new URL((input || '').trim());
    return url.protocol === 'https:' ? url.hostname.toLowerCase() : null;
  } catch (_) { return null; }
};

export function providerFor(value) {
  const host = domainOf(value);
  if (host === 'open.spotify.com') return 'spotify';
  if (host === 'soundcloud.com' || host === 'www.soundcloud.com' || host === 'on.soundcloud.com') return 'soundcloud';
  if (host === 'music.apple.com' || host === 'itunes.apple.com') return 'apple';
  return null;
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw Error('The music service is unavailable. Please try again.');
  return response.json();
}

export async function trackMetadata(input) {
  const url = (input || '').trim();
  const provider = providerFor(url);
  if (!provider) throw Error('Please use a valid official Spotify, Apple Music or SoundCloud link.');
  if (provider === 'apple') {
    const parsed = new URL(url);
    const trackId = parsed.searchParams.get('i') || (parsed.pathname.match(/\/id(\d+)/) || [])[1];
    if (trackId) {
      const results = await getJson('https://itunes.apple.com/lookup?id=' + encodeURIComponent(trackId));
      const match = results.results?.find(x => x.wrapperType === 'track' || x.kind === 'song') || results.results?.[0];
      if (match) return { title: match.trackName || match.collectionName || '', artist: match.artistName || '', artwork: match.artworkUrl100 || '' };
    }
    return { title: '', artist: '' };
  }
  const endpoint = provider === 'spotify'
    ? 'https://open.spotify.com/oembed?url=' + encodeURIComponent(url)
    : 'https://soundcloud.com/oembed?format=json&url=' + encodeURIComponent(url);
  const data = await getJson(endpoint);
  return { title: data.title || '', artist: data.author_name || '', artwork: data.thumbnail_url || '' };
}

export async function searchAppleCatalog(query) {
  if (!(query || '').trim()) return [];
  const params = 'term=' + encodeURIComponent(query.trim()) + '&entity=song&media=music&limit=20&country=US';
  const result = await getJson('https://itunes.apple.com/search?' + params);
  return (result.results || []).filter(x => x.trackViewUrl).map(x => ({
    id: String(x.trackId),
    title: x.trackName || '',
    artist: x.artistName || '',
    artwork: x.artworkUrl100 || '',
    url: x.trackViewUrl
  }));
}

export async function chooseOriginalAudio() {
  const selected = await DocumentPicker.getDocumentAsync({
    type: ['audio/mpeg','audio/mp4','audio/x-m4a','audio/wav','audio/x-wav','audio/aac','audio/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (selected.canceled) return null;
  const asset = selected.assets?.[0];
  if (!asset?.uri) throw Error('The selected audio file could not be opened.');
  if (asset.size && asset.size > MAX_AUDIO_BYTES) throw Error('Choose an audio file under 20 MB.');
  return asset;
}

export async function uploadOriginalAudio(userId, asset, closeFriends = false) {
  if (!supabase || !userId) throw Error('Sign in to upload original audio.');
  if (!asset?.uri) throw Error('Choose an original audio file first.');
  const file = new File(asset.uri);
  if (!file.exists || !file.size) throw Error('Memento could not read the audio file.');
  if (file.size > MAX_AUDIO_BYTES) throw Error('Original audio must be under 20 MB.');
  const name = (asset.name || '').toLowerCase();
  const extension = name.endsWith('.mp3') ? 'mp3' : name.endsWith('.wav') ? 'wav' :
    name.endsWith('.aac') ? 'aac' : 'm4a';
  const mime = extension === 'mp3' ? 'audio/mpeg' : extension === 'wav' ? 'audio/wav' :
    extension === 'aac' ? 'audio/aac' : 'audio/mp4';
  const path = `${closeFriends ? 'close-friends/' : ''}${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  const { error } = await supabase.storage.from(closeFriends ? 'memento-close-friends' : AUDIO_BUCKET).upload(
    path, await file.arrayBuffer(), { contentType: mime, upsert: false }
  );
  if (error) throw error;
  return path;
}

export async function signedAudio(path) {
  if (!path) return null;
  if (!supabase) throw Error('Supabase is not configured.');
  const { data, error } = await supabase.storage.from(path.startsWith('close-friends/') ? 'memento-close-friends' : AUDIO_BUCKET).createSignedUrl(path, path.startsWith('close-friends/') ? 60 : 3600);
  if (error) throw error;
  return data?.signedUrl || null;
}
