// The creator page's wiring for the techno bed (the synth is music-core.js).
import { audio, ensureAudio, startBeds, unlockMediaSession } from '../src/audio.js';
import { createMusic } from './music-core.js';
export { BEAT, BUILD_SECS } from './music-core.js';
import { game } from '../src/game.js';

var music = null, timer = 0;
// Call from a tap (the audio context needs a gesture on iPhone). Replaces the
// game's drone and noise bed; every effect (coins, pumps, smashes, crash)
// still plays through the game's master as before.
export function musicArm(){
  var ctx = ensureAudio(); if(!ctx) return;
  unlockMediaSession();
  startBeds();
  if(music) return;
  try{ audio.droneGain.disconnect(); audio.noiseGain.disconnect(); }catch(e){}
  music = createMusic(ctx, audio.master, function(){ return { lit: game.boost > 0, charge: game.charge, speed: game.speed }; });
  timer = setInterval(function(){ music.tick(ctx.currentTime + 0.12); }, 25);
}
export function musicScene(name){ if(music) music.scene(name); }
export function musicNow(){ return music ? music.now() : "off"; }
