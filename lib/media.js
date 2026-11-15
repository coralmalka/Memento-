// Image selection and private Supabase Storage upload helpers.
// Memento keeps the original aspect ratio. This module never crops an image.
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { supabase } from './supabase';

const MEDIA_BUCKET = 'memories';
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function requireMediaClient() {
  if (!supabase) throw Error('Supabase is not configured.');
  return supabase.storage.from(MEDIA_BUCKET);
}

function mimeForUri(uri) {
  const extension = (uri?.split('?')[0]?.split('.').pop() || '').toLowerCase();
  return ({
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif',
  })[extension] || 'image/jpeg';
}

export async function pickImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: false,
  });
  if (result.canceled) return null;
  const uri = result.assets?.[0]?.uri;
  if (!uri) throw Error('The selected photo could not be opened.');
  return uri;
}

export async function uploadImage(userId, uri) {
  if (!userId) throw Error('Sign in to upload a picture.');
  if (!uri) throw Error('Choose a picture first.');
  const file = new File(uri);
  if (!file.exists) throw Error('Could not read this photo from your device.');
  if (!file.size) throw Error('This photo appears to be empty.');
  if (file.size > MAX_IMAGE_BYTES) {
    throw Error('This image exceeds the current 10 MB Memento storage limit. Choose a smaller photo.');
  }
  const mimeType = mimeForUri(uri);
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp'
    : mimeType === 'image/heic' ? 'heic' : mimeType === 'image/heif' ? 'heif' : 'jpg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
  // ArrayBuffer is supported on Expo SDK 58; RN Blob/FormData uploads are unreliable with Supabase.
  const { error } = await requireMediaClient().upload(path, await file.arrayBuffer(), {
    contentType: mimeType,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) {
    if (/mime|type|format/i.test(error.message || '')) {
      throw Error('This image format is not accepted by your Supabase memories bucket. Try a JPEG, or update the allowed formats in Supabase Storage.');
    }
    throw error;
  }
  return path;
}

export async function signedImage(path) {
  if (!path) return null;
  // Private bucket: never make a permanent, publicly-accessible URL.
  const { data, error } = await requireMediaClient().createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data?.signedUrl || null;
}
