---
title: "How internet radio works"
metaTitle: "How Internet Radio Works: Streaming Explained Simply"
description: "How online radio works, step by step: encoding with MP3, AAC or Opus, bitrates, Icecast and HLS servers, song titles, and why browsers block some streams."
date: "2026-04-22"
updated: "2026-10-21"
author: "World Radio Stations"
tags: ["internet radio", "streaming", "explainer"]
---

Internet radio works by turning a station’s live audio into compressed digital data, sending it to a streaming server, and letting any connected device download and play that data as it arrives. There is no antenna or tuner involved: a stream is just a web address that keeps sending sound. That’s why one browser tab can play stations from more than 200 countries, and why a directory of stream addresses is all a player like ours needs.

Here’s what happens between the studio microphone and your speakers.

## From studio to speaker in five steps

1. **The station produces its programme** — live presenters, music from a playout system, ads and jingles — exactly as it would for FM.
2. **An encoder compresses the audio** into a streaming format such as MP3, AAC or Opus, at a chosen bitrate.
3. **The encoder sends it to a streaming server**, which might be the station’s own machine or a content delivery network (CDN).
4. **Your player connects to the stream URL.** That can be an app, a smart speaker, a car system or a web page like our [player](/#player).
5. **The player buffers a few seconds and plays.** It keeps downloading new audio just ahead of what you hear, so short network hiccups don’t interrupt playback.

Nothing is stored permanently on your device. Unlike a podcast, the stream only exists in the moment: if you pause and resume, you rejoin wherever the station is now.

## Encoding: MP3, AAC and Opus

Raw CD-quality stereo audio needs about 1,411 kbps — far too much for most listeners’ connections. Encoders use **lossy compression**: they discard detail the human ear is least likely to notice and squeeze the rest into a fraction of the size. The main formats:

- **MP3** — the oldest and most universally supported. Practically every device and browser can play it, which is why so many stations still use it.
- **AAC** — the successor to MP3, generally better-sounding at the same bitrate. Its high-efficiency variants (HE-AAC) use tricks such as rebuilding high frequencies from the lower ones, so they sound acceptable at very low bitrates; HE-AAC v2 is also the codec used by DAB+ digital radio.
- **Opus** — an open, royalty-free codec standardised by the IETF in 2012 (RFC 6716). It is very efficient, especially for speech, and is usually streamed in an Ogg container.
- **FLAC** — lossless, so nothing is thrown away. It needs far more bandwidth, and only a few stations offer it; [Radio Paradise](/stations/radio-paradise) is a well-known example.

## Bitrates: quality vs data

The bitrate is how much data the stream uses per second, measured in kilobits per second (kbps). Higher means better sound and more data:

| Bitrate | Typical use | Data per hour |
|---|---|---|
| 32–64 kbps | HE-AAC streams for mobile, speech stations | 14–29 MB |
| 96–128 kbps | Standard music streams (128 kbps is a very common setting for MP3) | 43–58 MB |
| 192–320 kbps | High-quality streams | 86–144 MB |

As a rule of thumb, a 128 kbps stream uses about 58 MB an hour. Our [FM vs internet radio](/blog/fm-vs-internet-radio) guide compares that with broadcast radio.

## Streaming servers: Icecast, SHOUTcast and HLS

### Icecast and SHOUTcast

The classic way to stream radio is a continuous HTTP connection. The station’s encoder (the “source”) pushes audio to a server, and the server relays it to every listener who connects to the stream’s address, called a mount point. SHOUTcast, created by Nullsoft — the company behind the Winamp player — in the late 1990s, popularised this approach. Icecast is the free, open-source alternative maintained by the Xiph.Org Foundation, and it can also talk to SHOUTcast-compatible players.

Because every listener has their own connection, the server’s bandwidth grows with the audience. A station with a few hundred listeners can run its own server; bigger broadcasters use relay servers or a CDN. You will also still see playlist files ending in .pls or .m3u, which simply point your player at the real stream address.

### HLS (HTTP Live Streaming)

HLS, introduced by Apple in 2009, works differently. The stream is cut into short segments, each a few seconds of audio, and listed in a playlist file ending in .m3u8. The player keeps re-reading the playlist and downloading new segments over ordinary web requests. Because the segments are just files, they spread easily across CDNs, and a station can offer several bitrates so the player can switch down on a weak mobile signal.

The trade-off is delay. A player usually waits for a few segments before it starts, so HLS streams often run 20–30 seconds or more behind live. Safari plays HLS natively; other browsers have usually needed a JavaScript player library such as hls.js.

## Now playing: how song titles reach your screen

How does a stream tell you what song is on? Icecast and SHOUTcast streams use a simple convention known as **ICY metadata**:

1. The player asks for metadata by sending a request header, `Icy-MetaData: 1`.
2. The server replies with an `icy-metaint` value: the number of audio bytes between each piece of metadata.
3. After every block of that many audio bytes, the server inserts a single length byte (multiplied by 16 to get the size) followed by text such as `StreamTitle='Artist - Title';`.
4. The station’s playout software updates that text whenever a new track starts.

Our player uses this. While a station plays, our server periodically reads the stream’s ICY metadata and shows the current title under the station name. Not every station sends it, and some send the show name or a slogan instead of the track. HLS streams carry this kind of information differently, so titles aren’t always available for them.

## Why browsers block some streams

If a station plays in an app but not in a browser, the usual culprit is **mixed content**. Pages served over secure HTTPS aren’t allowed to load audio over plain, unencrypted HTTP. Chrome 80, released in early 2020, began automatically trying `https://` for such audio and blocking it if that failed, and Firefox 127 did the same in 2024. Many older stations still stream only over HTTP, and on a secure page they simply stay silent.

That’s why our player lists only stations with an HTTPS stream address. You may find a station in a desktop app or media player that you can’t find here: it is probably HTTP-only. Codec support matters too — MP3 and AAC play almost everywhere, while some formats depend on the browser.

## Where the station list comes from: Radio Browser

A web player doesn’t host any audio itself. Ours relies on [Radio Browser](https://www.radio-browser.info), an open, community-maintained database of internet radio stations with a free public API. Tens of thousands of stations are listed, and for each one it records the name, stream URL, country, language, tags, codec and bitrate. Anyone can submit a new station.

Radio Browser also checks regularly whether streams are online and counts how often each station is played (one click per IP address per station per day) and voted for. When you [pick a country](/country), our player asks Radio Browser for that country’s stations sorted by those clicks, hides streams marked as broken or not served over HTTPS, and then plays the station’s own stream directly — we don’t copy, store or re-encode any audio.

## Why streams sometimes stop or buffer

- **Your connection** — weak mobile signal or a busy Wi-Fi network is the most common cause.
- **Server limits** — small stations cap how many listeners can connect at once.
- **Changed addresses** — stations sometimes move their stream, and directories take a while to catch up.
- **Rights restrictions** — some programmes, especially live sport, are blocked outside the station’s home country. See [how to listen to radio from another country](/blog/how-to-listen-radio-from-another-country).

## FAQ

### How does online radio work?

The station compresses its live audio into a format such as MP3 or AAC and sends it to a streaming server. Your device connects to the stream’s web address and plays the audio as it downloads, buffering a few seconds to keep playback smooth.

### Is internet radio live?

Yes, but slightly delayed. Buffering means most streams run a few seconds behind the broadcast, and HLS streams often run 20–30 seconds or more behind.

### How much data does internet radio streaming use?

It depends on the bitrate: about 43 MB an hour at 96 kbps, 58 MB at 128 kbps and 86 MB at 192 kbps.

### Do I need an app to listen to internet radio?

No. Many stations play directly in a web browser. Open our [player](/#player), choose a country on the globe and press play — no app or sign-up needed.
