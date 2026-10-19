document.getElementById('request').onclick = async () => {
  const result = document.getElementById('result');
  let stream;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mic = devices.find(d => d.deviceId === 'salesgod-ai-bridge-local-v1');
    if (!mic) throw new Error('Generated microphone was not enumerated.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: mic.deviceId } }, video: false });
    const track = stream.getAudioTracks()[0];
    if (track?.readyState !== 'live') throw new Error('Generated microphone track is not live.');
    result.textContent = 'PASS: page enumerated and requested the generated microphone. Live audio track returned.\n' + JSON.stringify(track.getSettings(), null, 2);
  } catch (error) { result.textContent = 'FAIL: ' + error.message; }
  finally { stream?.getTracks().forEach(t => t.stop()); }
};
document.getElementById('peer').onclick = () => window.postMessage({ source: 'salesgod-local-audio-v1', type: 'command', command: 'peer-test', requestId: crypto.randomUUID() }, location.origin);
