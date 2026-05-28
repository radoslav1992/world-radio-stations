---
title: "How internet radio works"
description: "A plain-English explanation of how online radio streams reach your device, and why thousands of stations are available in a browser."
date: "2026-04-22"
author: "World Radio Stations"
tags: ["internet radio", "streaming", "explainer"]
---

Internet radio lets you listen to stations from anywhere in the world without an antenna or a tuner. But what's actually happening when you press play? Here's a simple explanation.

## From the studio to a stream

A traditional radio station broadcasts over the air using radio frequencies. An internet station does something different: it sends its audio out as a continuous digital **stream** over the internet. The studio's audio is encoded — compressed into a format like MP3 or AAC — and sent to a streaming server.

That server has a web address (a stream URL). Any device that opens that URL can receive the audio and play it back, second by second, as it arrives. Nothing is downloaded permanently; the audio plays as it streams.

## What the bitrate means

Streams come at different qualities, measured in kilobits per second (kbps). A typical music station streams at somewhere between 96 and 192 kbps. Higher numbers mean better sound but more data used. Most stations strike a balance that sounds good without using too much bandwidth.

## Where station lists come from

A web player like ours doesn't host any audio itself. Instead, it relies on a directory of stations. We use [Radio Browser](https://www.radio-browser.info), an open, community-maintained database that tracks station names, stream URLs, genres, countries and more. When you [filter by country](/#player), the player asks that database for the most popular stations in that country and plays their streams directly.

## Why some streams don't play in a browser

Browsers have rules for security. They block streams that aren't served over a secure (HTTPS) connection, and they only support certain audio formats. That's why a web player sometimes shows fewer stations than a dedicated app — some streams simply can't be played safely in a browser.

## The upside

Because internet radio is just audio over the internet, the choice is enormous. Instead of the handful of stations you can pick up on an FM dial, you can reach thousands from around the world. Open the [player](/#player), pick a country, and start exploring.
