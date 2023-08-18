import * as path from 'path';
import * as fs from 'fs';
const DEEPGRAM_API_TOKEN = '';
import { performance } from 'node:perf_hooks';

// Uncomment what you want to run tests on
const mappings = {
  'nova': {
    models: [
      'general',
//  'phonecall'],
//     languages: [
//       'en',
//       'en-US',
//       'en-AU',
//       'en-GB',
//       'en-IN',
//       'en-NZ',
//       'es',
//       'es-419'
]
  },
  // 'base': {
  //   models: [
  //     'general',
  //     'meeting',
  //     'phonecall',
  //     'voicemail',
  //     'finance',
  //     'conversationalai',
  //     'video'],
  //   languages: [
  //     'zh',
  //     'zh-CN',
  //     'zh-TW',
  //     'da',
  //     'nl',
  //     'en',
  //     'en-US',
  //     'en-AU',
  //     'en-GB',
  //     'en-IN',
  //     'en-NZ',
  //     'fr',
  //     'fr-CA',
  //     'de',
  //     'hi',
  //     'hi-Latn',
  //     'id',
  //     'it',
  //     'ja',
  //     'ko',
  //     'no',
  //     'pl',
  //     'pt',
  //     'pt-BR',
  //     'pt-PT',
  //     'ru',
  //     'es',
  //     'es-419',
  //     'sv',
  //     'ta',
  //     'tr',
  //     'uk']
  // },
  // 'enhanced': {
  //   models: [
  //     'general',
  //     'meeting',
  //     'phonecall',
  //     'finance'],
  //   languages: [
  //     'da',
  //     'nl',
  //     'en',
  //     'en-US',
  //     'fr',
  //     'de',
  //     'hi',
  //     'it',
  //     'ja',
  //     'ko',
  //     'no',
  //     'pl',
  //     'pt',
  //     'pt-BR',
  //     'pt-PT',
  //     'es',
  //     'es-419',
  //     'sv',
  //     'ta']
  // }
};
let retries = 10;
let compare = true;
const files = fromDir('./audio_samples', '.mp3', '.wav');
console.log(files);
let mp3s = files.filter((file)=> file.indexOf('.mp3') != -1 || file.indexOf('.wav') != -1);

let stats = {};
for(let index = 0; index < mp3s.length; index++){
  let file = mp3s[index];
  stats[file] = {};
  console.log('\nTesting diarize with audio: ' + file.substring(14));
  const mp3 = './'+file;
  const txt = file.replace('.mp3', '.txt').replace('.wav', '.txt');

  var transcript = fs.readFileSync(txt, 'utf8');
  let speakers = parseTranscript(transcript);

  let tiers = Object.keys(mappings);
  let request_id = 0;
  for(let i=0; i<tiers.length; i++){
    let tier = tiers[i];
    let models = mappings[tier].models;
    for(let j=0; j<models.length; j++){
      let model = models[j];
      const url = 'https://api.deepgram.com/v1/listen?language=en-US&diarize=true&model='+model+'&tier='+tier;
      console.log('URL:', url);
      const filestats = fs.statSync(mp3);
      const fileSizeInBytes = filestats.size;
      console.log('\n' + model + '-' + tier + ':');
      let failed = 0;
      for(let test = 0; test <= retries; test++){
        let data = null;
        let success = false;
        let attempt = 0;
        while(!success){
          attempt++;
          request_id++;
          // console.log('Attempt:', attempt);
          let readStream = fs.createReadStream(mp3);
          try{
            var t0 = performance.now();

            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': 'Token ' + DEEPGRAM_API_TOKEN,
                    "Content-length": fileSizeInBytes
                },
                duplex: "half",
                body: readStream
            });
            data = await response.json();

            var t1 = performance.now();
            console.log('Request ['+request_id+'] took:', ((t1-t0)/1000).toFixed(2)+' sec');
            if(data && !data.error){
              success = true;
            }
          }catch(err){
            console.log('Error: ', err);
          }
        }
        if(compare){
          if(data && data.results){
            let processedSpeakers = parseDiarization(data);

            let passed = compareSpeakers(speakers, processedSpeakers);
            console.log('  Test[' + test + '] ' + (passed ? ' PASS' : ' FAIL'));
            fs.writeFile('./output/' + file.substring(14) + '_' + test + '_' + (passed ? ' PASS' : ' FAIL') + '_' + data.metadata.request_id+'.json', JSON.stringify(data, null, 2), 'utf8', ()=>{});
            if(!passed){
              failed++;
              console.log('   Speaker Detection Error: truth:', speakers.length, 'detected:', processedSpeakers.length, 'RequestID:', data.metadata.request_id);
            }
          }else {
            console.log('no data:', data);
          }
        }
      }
      stats[file][model+'-'+tier] = failed;
    }
  }
  console.log('file:', file, stats)
  console.log(JSON.stringify(stats))
}

console.log('FINISHED', stats)
console.log(JSON.stringify(stats))

function parseTranscript(transcript){
  let lines = transcript.split('\n');

  let speakers = [];
  lines.forEach(line => {
    let id = line.split(']')[0].substring(9,10);
    let speakerID = parseInt(id)-1;
    if(!speakers[speakerID]){
      speakers[speakerID] = [];
    }
    speakers[speakerID].push(line.substring(13));
  });
  return speakers;
}

function parseDiarization(data){
  let words = data.results.channels[0].alternatives[0].words;
  let speakers = [];
  let currentSpeaker = 0;
  let currentWords = '';
  words.forEach(word => {
    let speakerID = word.speaker;
    if(!speakers[speakerID]){
      speakers[speakerID] = [];
    }
    // Changing speaker
    if(speakerID != currentSpeaker){
      speakers[speakerID].push(currentWords.substring(0, currentWords.length - 1));
      currentWords = '';
      currentSpeaker = speakerID;
    }
    currentWords += word.word + ' ';
  });
  return speakers;
}

function compareSpeakers(truth, processed){
  return truth.length == processed.length;
}

function fromDir(startPath, filter1, filter2) {
  let paths = [];

  if (!fs.existsSync(startPath)) {
      console.log("no dir ", startPath);
      return;
  }

  var files = fs.readdirSync(startPath);
  for (var i = 0; i < files.length; i++) {
      var filename = path.join(startPath, files[i]);
      var stat = fs.lstatSync(filename);
      if (stat.isDirectory()) {
          fromDir(filename, filter1, filter2); //recurse
      } else if (filename.endsWith(filter1) || filename.endsWith(filter2)) {
          paths.push(filename);
      };
  };
  return paths;
};