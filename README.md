# deepgram-automated-tests

## To run the tests use
```
npm i
npm run start
```

The stats will be outputted after every audio file is processed in json format 

Example Output showing the Failure Count of the diarization for that audio file

```
{
  'audio_samples/Call_Center_Dynamite_Mobile.mp3': {
    'general-nova': 0,
    'phonecall-nova': 0,
    'general-base': 0,
    'meeting-base': 0,
    'phonecall-base': 0,
    'voicemail-base': 0,
    'finance-base': 0,
    'conversationalai-base': 10,
    'video-base': 0,
    'general-enhanced': 0,
    'meeting-enhanced': 0,
    'phonecall-enhanced': 0,
    'finance-enhanced': 0
  }
}
```