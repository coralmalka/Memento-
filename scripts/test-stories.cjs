const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const vm = require('node:vm');
async function main() {
 const db = new PGlite();
 await db.exec(`
 create role authenticated; create role anon;
 create schema auth; create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth,storage to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 create table public.stories(id uuid primary key default gen_random_uuid(),author_id uuid,image_path text,original_audio_path text,published_at timestamptz,expires_at timestamptz,source_story_id uuid);
 create table public.posts(id uuid primary key default gen_random_uuid(),author_id uuid,image_path text,original_audio_path text,source_story_id uuid);
 create table public.collections(id uuid primary key default gen_random_uuid(),cover_path text);
 create table public.collection_stories(story_id uuid);
 create table public.direct_messages(shared_story_id uuid);
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text);
 alter table storage.objects enable row level security;
 alter table public.stories enable row level security;
 -- Deliberately broad legacy policies prove restrictive guards cannot be OR-bypassed.
 create policy legacy_all on storage.objects for all to public using(true) with check(true);
 create policy legacy_all on public.stories for all to public using(true) with check(true);
 grant all on all tables in schema public,storage to authenticated,anon;
 `);
 const sql = fs.readFileSync('supabase/memento_story_editor_close_friends_20261115.sql','utf8');
 await db.exec(sql); await db.exec(sql); // repeatable migration
 const owner='00000000-0000-0000-0000-000000000001',friend='00000000-0000-0000-0000-000000000002',outsider='00000000-0000-0000-0000-000000000003';
 const path=`close-friends/${owner}/photo.jpg`, audio=`close-friends/${owner}/audio.m4a`;
 await db.exec(`insert into auth.users values('${owner}'),('${friend}'),('${outsider}');`);
 async function as(id,role='authenticated') { await db.exec(`reset role;set role ${role};select set_config('request.jwt.claim.sub','${id}',false);`); }
 async function count(table,where='true'){return (await db.query(`select count(*)::int as n from ${table} where ${where}`)).rows[0].n;}
 async function rejected(sql){await assert.rejects(db.exec(sql));}
 await as(owner);
 await db.exec(`insert into close_friends(owner_id,friend_id) values('${owner}','${friend}');insert into storage.objects values('memento-close-friends','${path}'),('memento-close-friends','${audio}');`);
 await db.exec(`insert into stories(author_id,image_path,original_audio_path,audience,published_at,expires_at) values('${owner}','${path}','${audio}','close_friends',now(),now()+interval '1 day');`);
 const id=(await db.query('select id from stories')).rows[0].id;
 assert.equal(await count('stories'),1);
 await as(friend); assert.equal(await count('stories'),1);assert.equal(await count('storage.objects'),2);assert.equal(await count('close_friends'),0);
 await rejected(`insert into close_friends(owner_id,friend_id) values('${owner}','${outsider}')`);
 await rejected(`insert into posts(image_path) values('${path}')`);
 await rejected(`insert into posts(source_story_id) values('${id}')`);
 await rejected(`insert into direct_messages(shared_story_id) values('${id}')`);
 await rejected(`insert into collections(cover_path) values('${path}')`);
 await rejected(`insert into collection_stories(story_id) values('${id}')`);
 await as(outsider);assert.equal(await count('stories'),0);assert.equal(await count('storage.objects'),0);
 await rejected(`insert into storage.objects values('memento-close-friends','${path}')`);
 assert.equal((await db.query(`delete from storage.objects returning *`)).rows.length,0);
 assert.equal((await db.query(`update storage.objects set name='stolen' returning *`)).rows.length,0);
 await as('', 'anon'); assert.equal(await count('stories'),0);assert.equal(await count('storage.objects'),0);
 await as(owner);
 await rejected(`update stories set audience='public' where id='${id}'`);
 await rejected(`insert into stories(author_id,image_path,audience) values('${owner}','${owner}/public.jpg','close_friends')`);
 await rejected(`insert into stories(author_id,image_path,audience) values('${owner}','${path}','public')`);
 await db.exec(`delete from close_friends where owner_id='${owner}'`);
 await as(friend);assert.equal(await count('stories'),0);assert.equal(await count('storage.objects'),0);
 await as(owner);await db.exec(`insert into close_friends(owner_id,friend_id) values('${owner}','${friend}');update stories set expires_at=now()-interval '1 second' where id='${id}'`);
 await as(friend);assert.equal(await count('stories'),0);assert.equal(await count('storage.objects'),0);
 await as(owner);assert.equal(await count('stories'),1);assert.equal(await count('storage.objects'),2);
 // Ordinary public stories and normal media still work with the legacy policy.
 await db.exec(`insert into stories(author_id,image_path) values('${owner}','${owner}/normal.jpg');insert into storage.objects values('memories','${owner}/normal.jpg');`);
 await as(outsider);assert.equal(await count('stories'),1);assert.equal(await count('storage.objects'),1);
 await db.close();
 console.log('PASS privacy: owner/friend/outsider/anonymous, private audio, revoked friend, expired story, repost/cover/DM rejection, public compatibility, migration rerun');

 const context={};vm.createContext(context);
 vm.runInContext(fs.readFileSync('lib/storyEdits.js','utf8').replace(/export /g,'')+'\nthis.edits={colorMatrix,DEFAULT_EDITS,FILTERS,outputSize};',context);
 const {colorMatrix,DEFAULT_EDITS,FILTERS,outputSize}=context.edits;
 const CK=await require('canvaskit-wasm/bin/full/canvaskit.js')();global.CanvasKit=CK;
 const {JsiSkApi}=require('@shopify/react-native-skia/lib/commonjs/skia/web');const Skia=JsiSkApi(CK);
 const renderContext={Skia,colorMatrix,outputSize};vm.createContext(renderContext);
 const editor=fs.readFileSync('components/StoryPhotoEditor.js','utf8');
 vm.runInContext(editor.slice(editor.indexOf('function renderPhoto('),editor.indexOf('export default'))+'\nthis.renderPhoto=renderPhoto;',renderContext);
 const surface=Skia.Surface.Make(4,2),canvas=surface.getCanvas(),paint=Skia.Paint();
 paint.setColor(Skia.Color('red'));canvas.drawRect(Skia.XYWHRect(0,0,2,2),paint);
 paint.setColor(Skia.Color('blue'));canvas.drawRect(Skia.XYWHRect(2,0,2,2),paint);
 const input=surface.makeImageSnapshot();
 const pixel=image=>image.readPixels(0,0,{width:image.width(),height:image.height(),colorType:CK.ColorType.RGBA_8888.value,alphaType:CK.AlphaType.Unpremul.value});
 const original=renderContext.renderPhoto(input,DEFAULT_EDITS,4096);
 assert.equal(original.width(),4);assert.equal(original.height(),2);
 const rotated=renderContext.renderPhoto(input,{...DEFAULT_EDITS,rotation:90},4096);assert.equal(rotated.width(),2);assert.equal(rotated.height(),4);
 const flipped=renderContext.renderPhoto(input,{...DEFAULT_EDITS,flip:true},4096);
 assert.ok(pixel(original)[0]>200 && pixel(flipped)[2]>200,'flip must actually move blue pixels to left');
 const noir=renderContext.renderPhoto(input,{...DEFAULT_EDITS,filter:'noir'},4096);
 const p=pixel(noir);assert.ok(Math.abs(p[0]-p[1])<=1&&Math.abs(p[1]-p[2])<=1,'Noir exports grayscale pixels');
 assert.notDeepEqual(Array.from(pixel(noir)),Array.from(pixel(original)));
 for(const f of FILTERS){const out=renderContext.renderPhoto(input,{...DEFAULT_EDITS,filter:f.id},4096);assert.ok(out.encodeToBytes(3,94).length);out.dispose();}
 assert.ok(original.encodeToBytes(3,94).length>0);
 const glyphs=require('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json');
 const sources=['components/StoryPhotoEditor.js','components/CloseFriendsPicker.js'].map(f=>fs.readFileSync(f,'utf8')).join('\n');
 for(const f of FILTERS)assert.ok(glyphs[f.icon],`Missing icon ${f.icon}`);
 for(const name of ['color-filter-outline','options-outline','planet-outline','star','people-circle-outline','swap-horizontal-outline','arrow-undo-outline'])assert.ok(glyphs[name]);
 [original,rotated,flipped,noir,input,surface,paint].forEach(x=>x.dispose());
 console.log('PASS image pixels: original, rotation, flip, Noir grayscale, six filters, encoded output and installed icon names');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
