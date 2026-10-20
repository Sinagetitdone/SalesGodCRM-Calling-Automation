# Calling lists — version 0.4.0

Initial implementation used synthetic contacts only. On 2026-10-20 an explicitly authorized real call exercised dispatch, dialer audio, greeting/beep detection, message playback, hangup, saved events and completion. The owner then reported that a person picked up and spoke during voicemail, but the system hung up. That call therefore failed human takeover, despite its playback-completed log. The takeover fix below has synthetic regression coverage only; no new call was made for the fix. Opening, importing or reloading never starts calls automatically.

### Human pickup during voicemail

Automatic mode retains response-disabled VAD and transcription during message playback and an eight-second quiet window afterward. New speech immediately stops prepared audio and cancels voicemail hangup; confirmed human speech starts the existing gated live conversation on the same connection. Recognition continues even after a greeting was marked voicemail. Delayed pre-message greeting events and obsolete classifier results cannot trigger a false takeover. The initial human utterance is saved when human classification is confirmed.

Speech awaiting transcription/classification blocks voicemail completion. After thirty seconds without a confirmed interpretation, the list requires review rather than claiming a successful voicemail. It does not replay a partially interrupted message. A disconnect while checking pickup also requires review. Noise/echo or uncertain classification can interrupt voicemail and require review; this is preferable to knowingly closing a possible human conversation. Manual supervised mode retains owner confirmation and now permits that control during playback too. Reopen local controls to load this fix; extension 0.4.0 itself is unchanged.

## Try without calling

Run `npm run audio:bridge`, open <http://127.0.0.1:28431/campaigns>, choose **Use simulated contacts**, **Import and preview**, then **Start selected list**. Keep **Simulation only** checked. This path never prepares audio, contacts OpenAI, or invokes the CRM driver. Results and transcripts are explicitly simulated. A browser test completed two synthetic contacts and displayed their saved transcript and completion notice.

## Import

```csv
first_name,last_name,phone
Alex,Example,+12025550101
Sam,Example,+12025550102
```

These numbers are fictional examples. Include country codes internationally; ten-digit numbers default to +1. Maximum 1,000 rows / 400 KB CSV. Quoted fields and BOM are supported. Normalized duplicate numbers are skipped within a list; invalid rows reject the import. Import creates a draft. Settings are copied into that draft; import a new draft to change them. No per-contact consent field is required for the owner's pre-authorized lists. Explicit Start records campaign-level authorization; suppression and window checks remain backend-enforced.

## Live operation — pending authorized integration verification

Live operation requires authorization for the contacts being called. The owner reloaded unpacked extension **0.4.0** for the single test; refreshing the idle CRM reconnected its previously closed phone. For new installations, reload and refresh while idle, connect the phone, refresh audio devices, and choose **Open calling list**. The local window pairs with that exact opener through nonce-checked private message ports. Directly opened pages support simulation but cannot start live lists.

For a live draft, uncheck Simulation, provide a caller number available in the CRM, review the voicemail and approved brief, and select the calling timezone/window. The default is 09:00–17:00 America/Los_Angeles. One timezone applies to the whole list; location is not inferred from numbers. Then explicitly Start. Keep both windows and the computer awake. Closing/sleeping, background throttling, network loss and logout may interrupt this foreground workflow. It is not a hosted scheduler.

The worker prepares silent AI and voicemail speech before a one-time dispatch permit. A separate CRM DOM adapter selects the generated bridge microphone and approved caller number, verifies the target, and clicks the observed Call control once. It rejects other calls, unavailable phone/microphone/caller, changed controls or uncertain identity. Hangup requires its owned attempt and a matching destination in the active heading. No provider API is invented.

Incoming English transcription is classified as human, voicemail, unavailable or unknown. Human startup still waits for verified media, audio-gate and VAD acknowledgements. The AI identifies itself from Jay Marketing Lab on behalf of Cena and follows only the approved brief. A finish_call tool requests hangup after closing audio drains; opt_out also suppresses the number. Voicemail requires a recognized greeting plus a completed beep and plays the saved message once. Playback completion does **not** prove carrier recording. Unknown speech, classification errors, missing beeps, mailbox failure or the existing five-minute AI limit require review. Previous successful supervised calls do not prove the new automatic workflow.

**Pause after current contact** lets that attempt finish. **Stop current call and pause** stops AI and attempts to end the verified owned call. If identity or command acknowledgement is uncertain, check the CRM manually. Unknown/failed attempts are never redialed automatically; explicit resume processes pending rows only.

## Results and storage

Results distinguish conversation completed, voicemail playback completed, no answer, suppressed, opted out, cancelled, failed, unknown and needs review. Completion banner/title appears after every row is processed; optional desktop notification requires browser permission. A paused list does not report completion. No email or external notification is sent.

View transcripts in the table. Export downloads JSON with settings, contacts, outcomes, timestamps, conversation turns, campaign transitions and available audio-session metadata. Voicemail has an outcome/event record rather than a customer conversation transcript. No audio recordings are saved.

Ignored `data/campaigns.db` stores sensitive contact details and text transcripts; `data/live-audio.db` stores audio metadata without transcript text. Inactive data is pruned after seven days on local service activity; opt-out suppression persists independently. Files are accessible to the OS user and are not encrypted by the application. Speech is sent to OpenAI during live calls. The standard API key stays in the ignored server-side `.env`.

Only one running list and active attempt are allowed. Dispatch is saved before the browser action; lost acknowledgement becomes unknown, never a blind retry. Transcripts are session-bound and idempotent. Ten-second heartbeats maintain a thirty-second lease. Expiry/restart recovers running **and paused** active attempts to unknown and pauses the list. Inspect/end any remaining CRM call before explicit resume.

`npm run check` covers parsing, authorization, suppression/window rechecks, single dispatch, lease/restart recovery, retention, transcript durability, synthetic worker sequencing, missing acknowledgements, DOM identity, automatic human startup and playback-drained ending. Tests use temporary databases, fake API responses and synthetic controls. No calls or paid API requests are required. Browser verification separately exercised import, preview, simulation, saved transcript and completion UI.
