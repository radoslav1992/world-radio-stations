// Genre directory. Each genre maps to a Radio Browser tag and powers a
// landing page (/genre/<slug>) with a scoped player and a crawlable list of
// the most-listened stations carrying that tag.
//
// Kept deliberately separate from MOODS (src/data/moods.ts): moods are
// activity collections (focus, sleep, workout…), genres are what the music
// or talk actually is. Tags that already anchor a mood page (ambient, relax,
// dance→workout aside, lofi, jazz, chillout) are not duplicated here except
// where the search intent is clearly different.

export interface Genre {
  slug: string;
  /** Short label for cards and pills. */
  title: string;
  /** Page H1, e.g. "Classical radio stations". */
  heading: string;
  /** Radio Browser tag used with /stations/bytagexact. */
  tag: string;
  emoji: string;
  /** One-line description for cards. */
  blurb: string;
  /** Intro paragraph for the genre page — unique, human copy. */
  intro: string;
}

export const GENRES: Genre[] = [
  {
    slug: 'classical',
    title: 'Classical',
    heading: 'Classical radio stations',
    tag: 'classical',
    emoji: '🎻',
    blurb: 'Symphonies, chamber music and opera from the great concert halls.',
    intro: 'From Bach cantatas at breakfast to a late-night Mahler symphony, classical radio is one of the oldest and best-served corners of broadcasting. Public networks like BBC Radio 3 and dozens of dedicated stations stream concert recordings, opera matinees and quiet piano hours around the clock — most of them commercial-free.',
  },
  {
    slug: 'news',
    title: 'News',
    heading: 'News radio stations',
    tag: 'news',
    emoji: '📰',
    blurb: 'Rolling news and current affairs from broadcasters worldwide.',
    intro: 'Radio is still the fastest way to follow a story as it develops. These stations carry rolling bulletins, correspondent reports and extended current-affairs programming — from all-news pioneers like franceinfo and 1010 WINS to the public broadcasters that anchor national life in their countries.',
  },
  {
    slug: 'talk',
    title: 'Talk',
    heading: 'Talk radio stations',
    tag: 'talk',
    emoji: '🎙️',
    blurb: 'Phone-ins, interviews and opinion — radio built on conversation.',
    intro: 'Talk radio runs on voices, not playlists: phone-ins, long interviews, debate and the occasional on-air argument. This collection spans the big national talkers — LBC in Britain, 2GB in Sydney, Newstalk in Ireland — alongside local stations where the host knows every caller by name.',
  },
  {
    slug: 'sports',
    title: 'Sports',
    heading: 'Sports radio stations',
    tag: 'sports',
    emoji: '🏟️',
    blurb: 'Live commentary, post-match phone-ins and 24/7 sports talk.',
    intro: 'Nothing beats radio commentary for following a match you can’t watch. Sports stations mix live play-by-play with round-the-clock analysis and gloriously unreasonable phone-ins — a format invented when WFAN flipped to all-sports in New York in 1987 and copied everywhere since.',
  },
  {
    slug: 'rock',
    title: 'Rock',
    heading: 'Rock radio stations',
    tag: 'rock',
    emoji: '🎸',
    blurb: 'Guitar-driven radio, from new releases to album classics.',
    intro: 'Rock radio ranges from stations premiering new guitar bands to those keeping the album era alive one deep cut at a time. Expect everything from indie and hard rock to the occasional acoustic session, served by some of the most opinionated programmers in broadcasting.',
  },
  {
    slug: 'classic-rock',
    title: 'Classic Rock',
    heading: 'Classic rock radio stations',
    tag: 'classic rock',
    emoji: '🤘',
    blurb: 'Led Zep, Floyd, Queen and the rest of the canon, all day long.',
    intro: 'The riffs that built FM radio. Classic rock stations play the canon — Led Zeppelin, Pink Floyd, Queen, AC/DC, the Stones — with the volume of music recorded between the late 1960s and early 1990s deep enough that no two days sound the same.',
  },
  {
    slug: 'pop',
    title: 'Pop',
    heading: 'Pop radio stations',
    tag: 'pop',
    emoji: '🎤',
    blurb: 'Current hits and recent favourites from the world’s biggest stations.',
    intro: 'The world’s most popular format, in every sense: current chart hits, fresh releases and the songs everyone will be sick of by summer. These are the stations with the big breakfast shows and the tight playlists — from national CHR networks to local hit stations on every continent.',
  },
  {
    slug: 'country',
    title: 'Country',
    heading: 'Country music radio stations',
    tag: 'country',
    emoji: '🤠',
    blurb: 'Nashville and beyond — new country, classics and Americana.',
    intro: 'Country is the most-listened music format on American radio, and its home base has never moved: WSM in Nashville has carried the Grand Ole Opry since 1925. This collection runs from mainstream new country to classic honky-tonk, bluegrass and Americana stations far outside the US.',
  },
  {
    slug: 'oldies',
    title: 'Oldies',
    heading: 'Oldies radio stations',
    tag: 'oldies',
    emoji: '📻',
    blurb: 'The hits of the 50s, 60s and 70s, still on the air.',
    intro: 'Doo-wop, Motown, the British Invasion and the golden age of AM radio — oldies stations keep the original hit era playing. Perfect background for a Sunday drive, and a reminder of just how many great records were cut before 1975.',
  },
  {
    slug: '80s',
    title: '80s',
    heading: '80s radio stations',
    tag: '80s',
    emoji: '🕹️',
    blurb: 'Synth-pop, new wave and stadium anthems on repeat.',
    intro: 'Synthesizers, big drums and even bigger choruses. Stations devoted to the 1980s play new wave, synth-pop, hair metal and the MTV-era hits that never really went away — one of the most loved decade formats in radio.',
  },
  {
    slug: '90s',
    title: '90s',
    heading: '90s radio stations',
    tag: '90s',
    emoji: '💿',
    blurb: 'Grunge, Britpop, eurodance and R&B from the CD decade.',
    intro: 'The decade of grunge, Britpop, eurodance, boy bands and golden-age hip hop — often within the same hour. Nineties stations trade on a simple truth: the songs you heard at sixteen never stop sounding good.',
  },
  {
    slug: 'hip-hop',
    title: 'Hip Hop',
    heading: 'Hip hop radio stations',
    tag: 'hiphop',
    emoji: '🎧',
    blurb: 'Rap and hip hop culture, from drive-time mixes to classic joints.',
    intro: 'From the South Bronx to every city on earth: hip hop stations carry new rap, mixshows with real DJs and the classics that built the culture. The format’s flagship remains New York’s Hot 97, but great hip hop radio now broadcasts in dozens of languages.',
  },
  {
    slug: 'rnb',
    title: 'R&B & Soul',
    heading: 'R&B radio stations',
    tag: 'rnb',
    emoji: '✨',
    blurb: 'Smooth vocals, slow jams and rhythm & blues old and new.',
    intro: 'Rhythm & blues radio spans sixty years of great singing — from classic soul and quiet storm slow jams to contemporary R&B. These stations are where the voice is the whole point.',
  },
  {
    slug: 'dance',
    title: 'Dance',
    heading: 'Dance radio stations',
    tag: 'dance',
    emoji: '🪩',
    blurb: 'Club anthems and upfront dance music, mixed loud.',
    intro: 'Radio’s dancefloor: chart dance, club anthems and DJ mixes that run all weekend. Many of these stations broadcast live from clubs and festivals, and the best of them have launched entire genres from a single late-night show.',
  },
  {
    slug: 'electronic',
    title: 'Electronic',
    heading: 'Electronic music radio stations',
    tag: 'electronic',
    emoji: '🎛️',
    blurb: 'Everything with a synthesizer — IDM, downtempo, electronica.',
    intro: 'The broader electronic church: electronica, downtempo, IDM, synthwave and sounds that don’t fit a club format. Electronic stations tend to be adventurous programmers — this is where you find the strange, beautiful stuff between genres.',
  },
  {
    slug: 'house',
    title: 'House',
    heading: 'House music radio stations',
    tag: 'house',
    emoji: '🎚️',
    blurb: 'Four-to-the-floor, from deep and soulful to piano classics.',
    intro: 'Born in Chicago, raised everywhere. House stations keep the four-to-the-floor pulse going with deep, soulful, funky and classic house — often in long DJ mixes that make an afternoon disappear.',
  },
  {
    slug: 'techno',
    title: 'Techno',
    heading: 'Techno radio stations',
    tag: 'techno',
    emoji: '🔊',
    blurb: 'Hard, hypnotic and made for after midnight.',
    intro: 'From Detroit’s originators to Berlin’s endless night, techno radio is hypnotic, functional and best played loud. Expect driving sets, live club feeds and very few interruptions.',
  },
  {
    slug: 'blues',
    title: 'Blues',
    heading: 'Blues radio stations',
    tag: 'blues',
    emoji: '🌃',
    blurb: 'Twelve bars, three chords and the truth.',
    intro: 'The root system of nearly all modern popular music. Blues stations play Delta originals, Chicago electric, jump blues and modern torchbearers — music that has been fixing bad days since the 1920s.',
  },
  {
    slug: 'soul',
    title: 'Soul & Funk',
    heading: 'Soul and funk radio stations',
    tag: 'soul',
    emoji: '💜',
    blurb: 'Motown, Stax, funk grooves and rare cuts.',
    intro: 'Motown polish, Stax grit and basslines that make sitting still impossible. Soul and funk stations dig deep — alongside the hits you’ll hear rare grooves and B-sides that crate-diggers spend decades hunting down.',
  },
  {
    slug: 'reggae',
    title: 'Reggae',
    heading: 'Reggae radio stations',
    tag: 'reggae',
    emoji: '🌴',
    blurb: 'Roots, dub, dancehall and one drop rhythms.',
    intro: 'Jamaica’s great gift to the world, broadcast from Kingston and well beyond. Reggae stations run from roots and dub to lovers rock and dancehall — sunshine you can stream in any weather.',
  },
  {
    slug: 'latin',
    title: 'Latin',
    heading: 'Latin radio stations',
    tag: 'latin',
    emoji: '💃',
    blurb: 'Salsa, reggaetón, cumbia and Latin pop.',
    intro: 'Some of the most energetic radio on earth. Latin stations move between salsa, reggaetón, bachata, cumbia and Latin pop — much of it live, loud and impossible to play quietly in the background.',
  },
  {
    slug: 'metal',
    title: 'Metal',
    heading: 'Metal radio stations',
    tag: 'metal',
    emoji: '⚡',
    blurb: 'Heavy riffs from thrash to doom, played without apology.',
    intro: 'Radio for the heavy end of the spectrum: thrash, death, doom, power and every other subgenre metalheads will happily argue about for hours. These stations play what mainstream rock radio won’t touch, at the volume it deserves.',
  },
  {
    slug: 'alternative',
    title: 'Alternative',
    heading: 'Alternative radio stations',
    tag: 'alternative',
    emoji: '🧷',
    blurb: 'Indie and left-of-centre guitar music, new and classic.',
    intro: 'The stations that play the bands before everyone else does. Alternative radio — from KROQ in Los Angeles to public tastemakers like BBC 6 Music and FM4 — has always been where new guitar music breaks first.',
  },
  {
    slug: 'folk',
    title: 'Folk',
    heading: 'Folk radio stations',
    tag: 'folk',
    emoji: '🪕',
    blurb: 'Traditional song, acoustic music and modern folk writers.',
    intro: 'Songs older than recording itself, and new writers keeping the tradition honest. Folk stations blend traditional music from their home regions with contemporary singer-songwriters, bluegrass and acoustic sessions.',
  },
  {
    slug: 'world-music',
    title: 'World',
    heading: 'World music radio stations',
    tag: 'world music',
    emoji: '🌍',
    blurb: 'Sounds from every tradition — Afrobeat to fado to gamelan.',
    intro: 'The whole point of internet radio in one format: Afrobeat from Lagos, fado from Lisbon, rai, cumbia, highlife and a hundred traditions in between. World music stations are the fastest way to hear somewhere you’ve never been.',
  },
  {
    slug: 'christian',
    title: 'Christian',
    heading: 'Christian radio stations',
    tag: 'christian',
    emoji: '🙏',
    blurb: 'Worship music, gospel and faith-based talk.',
    intro: 'One of radio’s largest and most loyal formats. Christian stations range from contemporary worship music and gospel to scripture teaching and faith-based talk, broadcasting in nearly every country and language.',
  },
  {
    slug: 'kids',
    title: 'Kids',
    heading: 'Kids radio stations',
    tag: 'kids',
    emoji: '🧒',
    blurb: 'Songs and stories for children — safe, cheerful listening.',
    intro: 'Radio made for small listeners: children’s songs, stories and cheerful presenters, with nothing you’d need to explain afterwards. A lifesaver on car journeys and rainy afternoons.',
  },
  {
    slug: 'schlager',
    title: 'Schlager',
    heading: 'Schlager radio stations',
    tag: 'schlager',
    emoji: '🍻',
    blurb: 'Feel-good German-language hits and Volksmusik.',
    intro: 'The unashamedly cheerful heart of German-language radio. Schlager stations play catchy, sentimental hits built for singing along — a format that fills stadiums in Germany and Austria and soundtracks every good Alpine après-ski.',
  },
];

export function getGenre(slug: string): Genre | undefined {
  return GENRES.find((g) => g.slug === slug);
}
