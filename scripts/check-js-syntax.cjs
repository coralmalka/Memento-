// Check Memento JavaScript source syntax before loading it in Expo Go.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const files = [
  'App.js',
  'components/StoryPhotoEditor.js',
  'components/CloseFriendsPicker.js',
  'lib/storyEdits.js',
  'components/ProfileEditor.js',
  'components/AccountSettings.js',
  'components/SecurityGate.js',
  'components/ShareComposer.js',
  'components/ContentInsights.js',
  'lib/supabase.js',
  'lib/media.js',
  'lib/music.js',
  'lib/hashtags.js'
];
let failed = false;
for (const file of files) {
  try {
    const source = fs.readFileSync(path.resolve(process.cwd(),file),'utf8');
    parser.parse(source, { sourceType:'module', plugins:['jsx'] });
    process.stdout.write('PASS '+file+'\n');
  } catch (error) {
    failed = true;
    process.stderr.write('FAIL '+file+': '+error.message+'\n');
  }
}
process.exitCode = failed ? 1 : 0;
