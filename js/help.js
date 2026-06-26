// ---- Help system — topic registry + requestHelp ----
const HELP_TOPICS = {
  cue: { title: 'Cue Shot Reference', url: 'https://github.com/distortthepreamp/adsr-visualiser/blob/main/docs/cue-shots.md' },
};

window.requestHelp = function(topic){
  const entry = HELP_TOPICS[topic];
  if(entry) window.open(entry.url, '_blank');
};
