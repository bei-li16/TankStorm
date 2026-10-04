"""Reproducible original battle Foley. No external samples, downloads or synthesis service.

Nine distinct PCM assets are generated once at build-authoring time, not in the game loop.
"""
from pathlib import Path
import hashlib
import json
import wave
import numpy as np

RATE = 44100
OUT = Path(__file__).parent / 'assets' / 'audio'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(702026)

def noise(n, rolloff=0.0, low=35, high=17000):
    freq = np.fft.rfftfreq(n, 1 / RATE)
    spectrum = np.fft.rfft(rng.standard_normal(n))
    shape = (np.maximum(freq, 70) / 400) ** (-rolloff)
    shape *= (1 - np.exp(-(freq / low) ** 4)) * np.exp(-(freq / high) ** 4)
    a = np.fft.irfft(spectrum * shape, n)
    return a / max(np.std(a), 1e-8)

def layer(n, decay, pitch=65, bend=30, texture=.5, brightness=7000):
    t = np.arange(n) / RATE
    phase = 2 * np.pi * (pitch * t + bend * .02 * (1 - np.exp(-t / .02)))
    body = np.sin(phase) + .19 * np.sin(phase * 1.83)
    transient = noise(n, .12, high=brightness)
    attack = 1 - np.exp(-t / .00055)
    return attack * (body * np.exp(-t / decay) + transient * texture * np.exp(-t / (decay * .45)))

def deposit(dst, src, at, gain=1):
    start = round(at * RATE)
    count = min(len(src), len(dst) - start)
    if count > 0:
        dst[start:start+count] += src[:count] * gain

manifest = {'method': 'Original offline procedural Foley; deterministic seed 702026; 44.1 kHz 16-bit PCM mono', 'assets': {}}
for cls in ['tank', 'tank_destroyer', 'spg', 'rocket']:
    for phase in ['fire', 'impact']:
        duration = {'tank': .70, 'tank_destroyer': .62, 'spg': 1.12, 'rocket': .94}[cls]
        if phase == 'impact': duration += .20
        n = int(duration * RATE); t = np.arange(n) / RATE; sound = np.zeros(n)
        if cls == 'tank':
            sound += layer(n, .105 if phase == 'fire' else .19, 61, 58, .86, 7300)
            sound += noise(n, .7, high=1900) * np.exp(-t / .23) * .26
            if phase == 'impact':
                for f in [740, 1117, 1783]: sound += np.sin(2*np.pi*f*t) * np.exp(-t/.063) * .18
            else:
                deposit(sound, layer(n, .017, 330, 0, .2), .065, .22) # breech mechanism
            description = 'Short cannon crack, weighty bass kick and breech clack' if phase == 'fire' else 'Dense armor clang, compact explosive thud and debris'
        elif cls == 'tank_destroyer':
            sound += layer(n, .067, 108, 145, 1.1, 14500)
            sound += noise(n, -.08, low=1500, high=12500) * np.exp(-t/.045) * .65
            if phase == 'impact':
                for f in [1307, 2371, 3853]: sound += np.sin(2*np.pi*f*t) * np.exp(-t/.09) * .28
                deposit(sound, layer(n,.035,290,0,.7),.052,.35)
            else:
                sound += np.sin(2*np.pi*(2100*t-1100*t*t)) * (1-np.exp(-t/.01)) * np.exp(-t/.065) * .14
            description = 'Very sharp high velocity snap and brief supersonic whistle' if phase == 'fire' else 'Bright piercing metallic clang and scattering fragments'
        elif cls == 'spg':
            sound += layer(n, .26 if phase == 'fire' else .38, 39, 47, .8, 3400)
            sound += noise(n, .72, high=2400) * (1-np.exp(-t/.009)) * np.exp(-t/.34) * .60
            for at, gain in [(.068,.3),(.147,.17),(.256,.10)]:
                deposit(sound, layer(n,.10,47,20,.6,1800),at,gain)
            description = 'Deep resonant howitzer boom with rolling low thunder' if phase == 'fire' else 'Large high explosive burst, prolonged rumble and falling debris'
        else:
            if phase == 'fire':
                # Distinct staged ignitions and sustained jet hiss; no cannon-like bass impulse.
                for at in [0, .075, .16, .245, .33, .42]:
                    jet = noise(n,.05,low=500,high=11000)
                    env=(1-np.exp(-t/.013))*np.exp(-t/.13)
                    jet=(jet*.65 + np.sin(2*np.pi*(450*t+1200*t*t))*.11)*env
                    deposit(sound,jet,at,.55)
                description = 'Six staggered rocket ignitions with sustained rising jet whoosh'
            else:
                for at, gain in [(0,1),(.075,.96),(.16,.92),(.245,.88),(.33,.84),(.42,.80)]:
                    # Crisp cluster pops, distinct from the launch's sustained jet hiss.
                    deposit(sound,layer(n,.075,104,100,1.25,12500),at,gain)
                sound += noise(n,.6,high=1500) * np.exp(-t/.25) * .16
                description = 'Staggered cluster explosions and short rattling debris'
        # Outdoor reflections, no strong indoor reverb. All files use a click-free tail.
        dry=sound.copy()
        for delay,gain in [(.083,.10),(.173,.05)]: deposit(sound,dry,delay,gain)
        sound=np.tanh(sound*.65)
        sound-=sound.mean()
        sound*=np.minimum(1,t/.001)*np.minimum(1,(duration-t)/.07)
        sound*=.86/max(abs(sound))
        pcm=np.round(sound*32767).astype('<i2')
        key=cls+'_'+phase;path=OUT/(key+'.wav')
        with wave.open(str(path),'wb') as wav:
            wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(RATE);wav.writeframes(pcm.tobytes())
        spectrum=abs(np.fft.rfft(sound));freq=np.fft.rfftfreq(n,1/RATE)
        manifest['assets'][key]={'file':path.name,'description':description,'seconds':round(duration,3),'peak':float(max(abs(sound))),'rms':round(float(np.sqrt(np.mean(sound**2))),4),'spectralCentroidHz':round(float(sum(spectrum*freq)/sum(spectrum))),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
# Shared vehicle destruction: secondary bass detonation, tearing plate and falling wreckage.
duration=1.55; n=int(duration*RATE); t=np.arange(n)/RATE
sound=layer(n,.32,37,42,.8,5200)
for at,gain in [(.035,.62),(.12,.34),(.29,.22),(.51,.12)]:
    deposit(sound,layer(n,.045,180,70,1.0,10500),at,gain)
sound+=noise(n,.6,high=2600)*(1-np.exp(-t/.02))*np.exp(-t/.43)*.42
sound=np.tanh(sound*.6); sound-=sound.mean()
sound*=np.minimum(1,t/.001)*np.minimum(1,(duration-t)/.09)
sound*=.86/max(abs(sound))
path=OUT/'vehicle_destroyed.wav'
with wave.open(str(path),'wb') as wav:
    wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(RATE)
    wav.writeframes(np.round(sound*32767).astype('<i2').tobytes())
spectrum=abs(np.fft.rfft(sound));freq=np.fft.rfftfreq(n,1/RATE)
manifest['assets']['vehicle_destroyed']={'file':path.name,'description':'Shared wreck blast, tearing armor plates and falling debris','seconds':duration,'peak':float(max(abs(sound))),'rms':round(float(np.sqrt(np.mean(sound**2))),4),'spectralCentroidHz':round(float(sum(spectrum*freq)/sum(spectrum))),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
assert len({v['sha256'] for v in manifest['assets'].values()}) == 9
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
