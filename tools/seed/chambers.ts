/**
 * LUMEN VAULT chamber recipes — hand-curated content. tools/build-data.ts
 * resolves titles to entity ids, generates chrono plaques / astrolabe
 * riddles / forge initial-runes deterministically, then PROVES every
 * chamber (and fails the build if any proof fails).
 *
 * Title references may carry a domain suffix to disambiguate, e.g. "Dune@LIT".
 * Lore is exactly two factual sentences; no invented quotations.
 */

export interface ArtifactRecipe {
  name: string;
  glyph: string;
  lore: string;
}
interface Base {
  title: string;
  intro: string;
  artifact: ArtifactRecipe;
}
export interface VennRecipe extends Base {
  kind: "venn";
  rings: string[];
  tiles: string[];
  brainstorm?: boolean;
}
export interface ChronoRecipe extends Base {
  kind: "chrono";
  gears: string[];
}
export type RuneRecipe = { sensory: string } | { domain: string } | { facet: string };
export interface ForgeRecipe extends Base {
  kind: "forge";
  runes: [RuneRecipe, RuneRecipe];
}
export interface AstroRecipe extends Base {
  kind: "astrolabe";
  answer: string;
  candidates: string[];
}
export type ChamberRecipe = VennRecipe | ChronoRecipe | ForgeRecipe | AstroRecipe;

export interface WingRecipe {
  id: string;
  title: string;
  theme: string;
  chambers: ChamberRecipe[];
}

export const WINGS: WingRecipe[] = [
  {
    id: "wing-cinema",
    title: "Cinema & Sound",
    theme: "Projected light and the music of the spheres.",
    chambers: [
      {
        kind: "venn",
        title: "First Light",
        intro: "Two brass rings hum on the glass. Slip each vellum tile into the region where it truly belongs — several may share a home.",
        rings: ["SETTING_SPACE_SCIFI", "WON_OSCAR"],
        tiles: ["Star Wars", "Blade Runner", "Casablanca", "Psycho", "Avengers: Endgame", "Forrest Gump"],
        artifact: {
          name: "The First Reel",
          glyph: "reel",
          lore: "Star Wars won six competitive Oscars, including Best Visual Effects and Best Original Score. Its starship shots were filmed with a computer-controlled camera rig built specially for the production.",
        },
      },
      {
        kind: "chrono",
        title: "Reels in Time",
        intro: "Four reels from four eras of cinema. Read the plaques and wind them into their true order.",
        gears: ["A Trip to the Moon", "Metropolis", "Casablanca", "Psycho"],
        artifact: {
          name: "The Méliès Moon",
          glyph: "moon",
          lore: "Georges Méliès made A Trip to the Moon in 1902, and its rocket lodged in the Moon's eye became one of cinema's first iconic images. Before turning to film, Méliès was a stage magician who ran his own theatre of illusions in Paris.",
        },
      },
      {
        kind: "forge",
        title: "The Cold Open",
        intro: "The prism is thirsty for cold light. Offer three films that answer every rune at once.",
        runes: [{ sensory: "COLD" }, { domain: "FILM" }],
        artifact: {
          name: "The Frost Shard",
          glyph: "crystal",
          lore: "Fargo won the Oscar for Best Original Screenplay, and Frances McDormand won Best Actress as police chief Marge Gunderson. A mild winter forced the crew to chase snow into North Dakota to finish filming.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Projectionist's Dial",
        intro: "Nine names circle the lens. Read the riddles, cloud every name they rule out, and focus on the one that remains.",
        answer: "Casablanca",
        candidates: ["Spirited Away", "Amélie", "Imagine", "Thriller", "Seven Samurai", "Metropolis", "Parasite", "Silent Night"],
        artifact: {
          name: "The Projectionist's Lens",
          glyph: "lens",
          lore: "Casablanca premiered in New York in November 1942, just weeks after Allied forces landed in North Africa. It went on to win the Academy Award for Best Picture.",
        },
      },
      {
        kind: "venn",
        title: "The Gilded Reel",
        intro: "Three rings of gold. Place the tiles — then turn the final tumbler yourself: name any 20th-century film that won a competitive Oscar.",
        rings: ["DOMAIN_FILM", "WON_OSCAR", "CENTURY_20TH"],
        tiles: ["Titanic", "Let It Go", "Seven Samurai", "Bohemian Rhapsody", "Spirited Away", "Moon River", "Despacito"],
        brainstorm: true,
        artifact: {
          name: "The Gilded Reel",
          glyph: "star",
          lore: "Titanic won eleven Academy Awards, tying the record first set by Ben-Hur. At its release it was the most expensive film ever made.",
        },
      },
      {
        kind: "chrono",
        title: "Drawn in Light",
        intro: "Five animated wonders, one true order. The plaques remember.",
        gears: ["Snow White and the Seven Dwarfs", "Toy Story", "Spirited Away", "WALL-E", "Coco"],
        artifact: {
          name: "The Animator's Spiral",
          glyph: "spiral",
          lore: "Snow White and the Seven Dwarfs (1937) was Disney's first feature-length animated film. Toy Story followed in 1995 as the first feature made entirely with computer animation.",
        },
      },
      {
        kind: "forge",
        title: "Night Music",
        intro: "A forge that burns at midnight. Three works of night music will wake it.",
        runes: [{ sensory: "NOCTURNAL" }, { domain: "MUS" }],
        artifact: {
          name: "The Nocturne Moon",
          glyph: "note",
          lore: "Frédéric Chopin composed twenty-one nocturnes for solo piano. He borrowed the name of the form from the Irish composer John Field, who wrote the first piano nocturnes.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Composer's Dial",
        intro: "A ring of melodies. One of them is the hidden artifact — the riddles know which.",
        answer: "Clair de Lune",
        candidates: ["Moonlight Sonata", "Rhapsody in Blue", "Boléro", "Silent Night", "Dancing Queen", "Gangnam Style", "Hotel California", "Messiah"],
        artifact: {
          name: "The Verlaine Lyre",
          glyph: "lyre",
          lore: "Debussy's Clair de Lune is the third movement of his Suite bergamasque, published in 1905. Its title, meaning moonlight, comes from a poem by Paul Verlaine.",
        },
      },
    ],
  },
  {
    id: "wing-inventions",
    title: "Inventions & Science",
    theme: "Ideas that rewired the world.",
    chambers: [
      {
        kind: "venn",
        title: "Before the Century Turned",
        intro: "Invention is a kind of light. Sort the tiles between the rings of making and of time.",
        rings: ["INVENTED", "PRE_1900"],
        tiles: ["Light Bulb", "Telephone", "iPhone", "Laser", "Mona Lisa", "Penicillin", "Paper", "Theory of Relativity"],
        artifact: {
          name: "The Edison Orb",
          glyph: "orb",
          lore: "Thomas Edison's laboratory tested thousands of materials before settling on carbonised bamboo for longer-lasting filaments. His Pearl Street Station in Manhattan began supplying electricity in 1882.",
        },
      },
      {
        kind: "chrono",
        title: "Engines of Change",
        intro: "Four machines that changed how the world worked. Deduce their order from the plaques alone.",
        gears: ["Printing Press", "Telescope", "Watt Steam Engine", "Telephone"],
        artifact: {
          name: "The Gutenberg Key",
          glyph: "key",
          lore: "Johannes Gutenberg's press in Mainz combined movable metal type, oil-based ink and a screw press. His Bible, printed around 1455, was the first major book printed with movable type in Europe.",
        },
      },
      {
        kind: "forge",
        title: "Old Light of Reason",
        intro: "The prism wants discoveries made before 1900. Offer three.",
        runes: [{ facet: "DISCOVERED" }, { facet: "PRE_1900" }],
        artifact: {
          name: "The Mendeleev Flask",
          glyph: "flask",
          lore: "Dmitri Mendeleev published his periodic table in 1869 and left gaps for elements no one had yet found. Gallium, discovered in 1875, matched his predictions closely.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Inventor's Dial",
        intro: "Nine creations orbit the lens. The riddles point to one.",
        answer: "Telephone",
        candidates: ["Light Bulb", "Radio", "Airplane", "Printing Press", "Penicillin", "Laser", "Lightning Rod", "Insulin"],
        artifact: {
          name: "The Signal Bell",
          glyph: "bolt",
          lore: "Alexander Graham Bell was granted his telephone patent in March 1876. Days later he made the first call, to his assistant Thomas Watson in the next room.",
        },
      },
      {
        kind: "venn",
        title: "The Lone Discoverers",
        intro: "Three rings for the solitary mind. Place the tiles, then name any discovery made in Europe by one person.",
        rings: ["DISCOVERED", "REGION_EUROPE", "CREATOR_SOLO"],
        tiles: ["Penicillin", "DNA Double Helix", "Insulin", "Telescope", "Radium", "Telephone", "Discovery of Pluto"],
        brainstorm: true,
        artifact: {
          name: "The Fleming Plate",
          glyph: "eye",
          lore: "Alexander Fleming noticed in 1928 that mould on a culture plate had killed the bacteria around it. Howard Florey and Ernst Chain later turned penicillin into a usable medicine, and all three shared the 1945 Nobel Prize.",
        },
      },
      {
        kind: "chrono",
        title: "Signals Through the Ages",
        intro: "Five inventions that taught the world to speak at a distance. The plaques remember their order.",
        gears: ["Telephone", "Light Bulb", "Radio", "Television", "World Wide Web"],
        artifact: {
          name: "The Signal Gear",
          glyph: "gear",
          lore: "Tim Berners-Lee proposed the World Wide Web at CERN in 1989. CERN released the underlying software into the public domain in 1993.",
        },
      },
      {
        kind: "forge",
        title: "The Modern Workshop",
        intro: "Three inventions of the twentieth century will fill the prism.",
        runes: [{ facet: "INVENTED" }, { facet: "CENTURY_20TH" }],
        artifact: {
          name: "The Kitty Hawk Wing",
          glyph: "wing",
          lore: "The Wright brothers' first powered flight at Kitty Hawk in 1903 lasted twelve seconds and covered about 120 feet. Orville was at the controls while Wilbur ran alongside the wing.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Physicist's Dial",
        intro: "Discoveries and devices crowd the dial. Deduce exactly, eliminate kindly.",
        answer: "X-rays",
        candidates: ["Radium", "Insulin", "DNA Double Helix", "Discovery of Pluto", "Penicillin", "Vaccination", "Telephone", "Big Bang Theory"],
        artifact: {
          name: "The Röntgen Prism",
          glyph: "prism",
          lore: "Wilhelm Röntgen discovered X-rays in 1895 and soon made an image of the bones in his wife's hand. He received the first Nobel Prize in Physics in 1901.",
        },
      },
    ],
  },
  {
    id: "wing-myth",
    title: "Myth & World Wonders",
    theme: "Old stones, older stories.",
    chambers: [
      {
        kind: "venn",
        title: "Stones of the Old World",
        intro: "Stones remember what empires forget. Place each tile where the ancient world and human building overlap — or don't.",
        rings: ["ANCIENT_WORLD", "MAN_MADE_STRUCTURE"],
        tiles: ["Pyramids of Giza", "Colosseum", "The Odyssey", "Eiffel Tower", "Apollo 11", "Parthenon", "Taj Mahal", "The Iliad"],
        artifact: {
          name: "The Old Crown",
          glyph: "crown",
          lore: "The Great Pyramid of Giza was the tallest human-made structure on Earth for more than 3,800 years. It is the only one of the Seven Wonders of the Ancient World still standing.",
        },
      },
      {
        kind: "chrono",
        title: "Ages of Stone",
        intro: "Four monuments, three thousand years apart. Let the plaques set them in order.",
        gears: ["Pyramids of Giza", "Parthenon", "Colosseum", "Hagia Sophia"],
        artifact: {
          name: "The Justinian Dome",
          glyph: "tower",
          lore: "Hagia Sophia was completed in Constantinople in 537 under Emperor Justinian. It served as the world's largest cathedral for nearly a thousand years.",
        },
      },
      {
        kind: "forge",
        title: "Gods of Thunder",
        intro: "The sky darkens over the forge. Offer three storm-bringers of myth.",
        runes: [{ sensory: "STORM" }, { domain: "MYTH" }],
        artifact: {
          name: "The Thunder Bolt",
          glyph: "bolt",
          lore: "In Norse myth Thor's hammer is called Mjölnir. Thursday is named after him.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Mountain Dial",
        intro: "Nine wonders of stone. One stands where the riddles point.",
        answer: "Machu Picchu",
        candidates: ["Taj Mahal", "Colosseum", "Angkor Wat", "Forbidden City", "Great Wall of China", "Christ the Redeemer", "Stonehenge", "Notre-Dame de Paris"],
        artifact: {
          name: "The Inca Sun",
          glyph: "sun",
          lore: "Machu Picchu was built for the Inca emperor Pachacuti in the 15th century, high on a ridge above the Urubamba valley. Hiram Bingham brought it to international attention in 1911.",
        },
      },
      {
        kind: "venn",
        title: "The Thunder Rings",
        intro: "Three rings of myth and weather. Every figure has exactly one home.",
        rings: ["DEITY", "REGION_EUROPE", "SENSE_STORM"],
        tiles: ["Zeus", "Athena", "Indra", "Thunderbird", "Medusa", "Ra", "Kraken"],
        artifact: {
          name: "The Olympian Bolt",
          glyph: "flame",
          lore: "In Greek myth Zeus ruled from Mount Olympus and hurled thunderbolts forged for him by the Cyclopes. The ancient Olympic Games were held in his honour at Olympia.",
        },
      },
      {
        kind: "chrono",
        title: "Walls and Watchtowers",
        intro: "Five builders' dreams across two thousand years. Mesh the gears.",
        gears: ["Great Wall of China", "Lighthouse of Alexandria", "Hadrian's Wall", "Angkor Wat", "Machu Picchu"],
        artifact: {
          name: "The Pharos Lamp",
          glyph: "comet",
          lore: "The Lighthouse of Alexandria stood on the island of Pharos, whose name became the word for lighthouse in several languages, such as French phare. Earthquakes damaged it badly before its last remains fell in the 14th century.",
        },
      },
      {
        kind: "forge",
        title: "Keepers of the Flame",
        intro: "Fire answers fire. Offer three figures of myth who burn.",
        runes: [{ sensory: "FIRE" }, { domain: "MYTH" }],
        artifact: {
          name: "The Stolen Ember",
          glyph: "flame",
          lore: "In Greek myth Prometheus stole fire from the gods and gave it to humankind. As punishment Zeus chained him to a rock, where an eagle came each day to eat his liver.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Marble Dial",
        intro: "Palaces and towers crowd the dial. Eliminate kindly, deduce exactly.",
        answer: "Taj Mahal",
        candidates: ["Palace of Versailles", "Forbidden City", "Rialto Bridge", "Hagia Sophia", "Borobudur", "Burj Khalifa", "Petronas Towers", "Leaning Tower of Pisa"],
        artifact: {
          name: "The Marble Key",
          glyph: "key",
          lore: "Mughal emperor Shah Jahan commissioned the Taj Mahal in Agra as a tomb for his wife Mumtaz Mahal. The mausoleum was finished around 1643, and the wider complex about a decade later.",
        },
      },
    ],
  },
  {
    id: "wing-letters",
    title: "Art & Letters",
    theme: "Ink, oil and the long memory of stories.",
    chambers: [
      {
        kind: "venn",
        title: "The Painter's Threshold",
        intro: "Paint or stone? Old or new? Every tile has its region.",
        rings: ["PAINTING", "PRE_1900"],
        tiles: ["Mona Lisa", "The Starry Night", "Guernica", "Nighthawks", "David (Michelangelo)", "The Thinker", "Venus de Milo", "Campbell's Soup Cans"],
        artifact: {
          name: "The Gioconda Feather",
          glyph: "feather",
          lore: "Leonardo da Vinci began the Mona Lisa around 1503 and kept refining it for years. It was stolen from the Louvre in 1911 and recovered in 1913.",
        },
      },
      {
        kind: "chrono",
        title: "Brushstrokes Through Time",
        intro: "Four masterpieces, four centuries. Let the plaques hang them in order.",
        gears: ["The Last Supper", "Girl with a Pearl Earring", "The Great Wave off Kanagawa", "The Starry Night"],
        artifact: {
          name: "The Delft Pearl",
          glyph: "orb",
          lore: "Girl with a Pearl Earring is a tronie, a Dutch study of a face rather than a portrait of a known sitter. Johannes Vermeer painted it in Delft around 1665.",
        },
      },
      {
        kind: "forge",
        title: "Painted Water",
        intro: "The prism wants paint that remembers water. Offer three works of art.",
        runes: [{ sensory: "AQUATIC" }, { domain: "ART" }],
        artifact: {
          name: "The Le Havre Wave",
          glyph: "wave",
          lore: "Claude Monet's Impression, Sunrise shows the port of Le Havre in morning mist. A critic mocked its title in 1874, and the name Impressionism stuck to the whole movement.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Printmaker's Dial",
        intro: "Nine treasures of art and word. One answers every riddle.",
        answer: "The Great Wave off Kanagawa",
        candidates: ["The Starry Night", "Mona Lisa", "Nighthawks", "Terracotta Army", "The Two Fridas", "Bust of Nefertiti", "Moonlight Sonata", "The Tale of Genji"],
        artifact: {
          name: "The Kanagawa Crest",
          glyph: "mountain",
          lore: "Hokusai's Great Wave is a woodblock print from his series Thirty-six Views of Mount Fuji. Thousands of impressions were printed, and many survive in museums around the world.",
        },
      },
      {
        kind: "venn",
        title: "The Gilded Library",
        intro: "Three rings of the long nineteenth century. Place the books — then name any 19th-century European novel.",
        rings: ["NOVEL", "REGION_EUROPE", "CENTURY_19TH"],
        tiles: ["Pride and Prejudice", "Moby-Dick", "Don Quixote", "Hamlet", "The Great Gatsby", "A Christmas Carol", "Things Fall Apart"],
        brainstorm: true,
        artifact: {
          name: "The Austen Quill",
          glyph: "quill",
          lore: "Jane Austen published Pride and Prejudice in 1813 without her name on the title page. An early draft of the novel had been called First Impressions.",
        },
      },
      {
        kind: "chrono",
        title: "Pages Through Time",
        intro: "Five books across a thousand years. Shelve them in true order.",
        gears: ["Beowulf", "The Divine Comedy", "Don Quixote", "Frankenstein", "Nineteen Eighty-Four"],
        artifact: {
          name: "The Diodati Scroll",
          glyph: "scroll",
          lore: "Mary Shelley began Frankenstein during the wet summer of 1816 at the Villa Diodati near Geneva, after Lord Byron suggested that everyone write a ghost story. The novel was published in 1818, when she was twenty.",
        },
      },
      {
        kind: "forge",
        title: "Midnight Pages",
        intro: "Books that belong to the night. Offer three.",
        runes: [{ sensory: "NOCTURNAL" }, { domain: "LIT" }],
        artifact: {
          name: "The Lyceum Mask",
          glyph: "mask",
          lore: "Bram Stoker's Dracula was published in 1897 and told almost entirely through letters, diary entries and newspaper clippings. Stoker managed London's Lyceum Theatre for much of his working life.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Storyteller's Dial",
        intro: "Nine stories circle the lens. The riddles leave only one.",
        answer: "Don Quixote",
        candidates: ["Things Fall Apart", "The Tale of Genji", "The Odyssey", "Moby-Dick", "Journey to the West", "One Hundred Years of Solitude", "The Divine Comedy", "Robinson Crusoe"],
        artifact: {
          name: "The Windmill Compass",
          glyph: "compass",
          lore: "Miguel de Cervantes published the first part of Don Quixote in 1605 and the second in 1615. The phrase tilting at windmills comes from the knight's charge at windmills he mistakes for giants.",
        },
      },
    ],
  },
  {
    id: "wing-wild",
    title: "Wild Earth",
    theme: "Fur, fin, ice and the threads of life.",
    chambers: [
      {
        kind: "venn",
        title: "Fin or Fur",
        intro: "Which creatures nurse their young, and which live in water? Some do both.",
        rings: ["MAMMAL", "SENSE_AQUATIC"],
        tiles: ["Blue Whale", "Orca", "Great White Shark", "Lion", "Ostrich", "Octopus", "Platypus", "Bald Eagle"],
        artifact: {
          name: "The Whale Conch",
          glyph: "shell",
          lore: "The blue whale is the largest animal known to have ever lived, larger than any dinosaur. Its low calls are among the loudest sounds made by any animal.",
        },
      },
      {
        kind: "chrono",
        title: "The Thread of Life",
        intro: "Four turning points in understanding life. The plaques set the order.",
        gears: ["Cell Theory", "On the Origin of Species", "DNA Double Helix", "Human Genome Project"],
        artifact: {
          name: "The Beagle Seed",
          glyph: "seed",
          lore: "Charles Darwin published On the Origin of Species in November 1859, more than twenty years after his voyage on HMS Beagle. Alfred Russel Wallace had reached a similar theory independently.",
        },
      },
      {
        kind: "forge",
        title: "Creatures of the Water",
        intro: "The prism dreams of water. Name three creatures that swim, dive or wade.",
        runes: [{ sensory: "AQUATIC" }, { domain: "ANI" }],
        artifact: {
          name: "The Xochimilco Drop",
          glyph: "drop",
          lore: "The axolotl lives wild only in the lake and canal system of Xochimilco near Mexico City. It can regrow lost limbs and even parts of its heart.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Naturalist's Dial",
        intro: "Creatures, peaks and stories share the dial. One answers every riddle.",
        answer: "Giant Panda",
        candidates: ["Mount Everest", "Koala", "Lion", "Bald Eagle", "Great Wall of China", "Amaterasu", "Polar Bear", "Amazon Rainforest", "Sushi"],
        artifact: {
          name: "The Bamboo Leaf",
          glyph: "leaf",
          lore: "Giant pandas spend most of their waking hours eating bamboo, often twelve kilograms or more a day. In 2016 the IUCN moved the species from Endangered to Vulnerable as wild numbers grew.",
        },
      },
      {
        kind: "venn",
        title: "The Frozen Crown",
        intro: "Three rings of ice and stone. Place the tiles, then name any cold wonder of nature.",
        rings: ["DOMAIN_NATURE", "SENSE_COLD", "TIMELESS"],
        tiles: ["Mount Everest", "Sahara Desert", "Emperor Penguin", "Zeus", "Titanic", "Lake Baikal", "Mount Kilimanjaro"],
        brainstorm: true,
        artifact: {
          name: "The Summit Crystal",
          glyph: "mountain",
          lore: "Tenzing Norgay and Edmund Hillary made the first confirmed ascent of Mount Everest on 29 May 1953. Its summit stands about 8,849 metres above sea level.",
        },
      },
      {
        kind: "chrono",
        title: "The Healers' Wheel",
        intro: "Five breakthroughs in medicine. Deduce the order they arrived in.",
        gears: ["Blood Circulation", "Vaccination", "Germ Theory of Disease", "Penicillin", "Polio Vaccine"],
        artifact: {
          name: "The Jenner Lancet",
          glyph: "hourglass",
          lore: "In 1796 Edward Jenner tested his smallpox vaccine using material from a cowpox sore. The word vaccine comes from the Latin vacca, meaning cow.",
        },
      },
      {
        kind: "forge",
        title: "Cold Wonders",
        intro: "High peaks, frozen lakes, ice and auroras. Offer three cold wonders of nature.",
        runes: [{ sensory: "COLD" }, { domain: "NAT" }],
        artifact: {
          name: "The Baikal Mirror",
          glyph: "crystal",
          lore: "Lake Baikal in Siberia is the deepest lake on Earth, reaching more than 1,600 metres. It holds roughly a fifth of the world's unfrozen surface fresh water.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Thundering Dial",
        intro: "Waters, deserts and legends ring the lens. One remains when the riddles are read.",
        answer: "Victoria Falls",
        candidates: ["Niagara Falls", "Angel Falls", "Lion", "Pyramids of Giza", "Anubis", "Iguazu Falls", "Mount Fuji", "Great Barrier Reef", "Coffee"],
        artifact: {
          name: "The Smoke That Thunders",
          glyph: "drop",
          lore: "Victoria Falls lies on the Zambezi River between Zambia and Zimbabwe. Its local name, Mosi-oa-Tunya, means the smoke that thunders.",
        },
      },
    ],
  },
  {
    id: "wing-stars",
    title: "Stars & Machines",
    theme: "Rockets, probes and patient telescopes.",
    chambers: [
      {
        kind: "venn",
        title: "Agency and Age",
        intro: "Who built it — and in which century? Place each tile.",
        rings: ["CREATOR_TEAM_GOVERNMENT_AGENCY", "CENTURY_21ST"],
        tiles: ["James Webb Space Telescope", "Perseverance Rover", "Voyager 1", "Sputnik 1", "Falcon 9", "Interstellar", "Hubble Space Telescope", "Telescope"],
        artifact: {
          name: "The Webb Mirror",
          glyph: "astrolabe",
          lore: "The James Webb Space Telescope launched on 25 December 2021 and works near the Sun–Earth L2 point, about 1.5 million kilometres from Earth. Its 6.5-metre mirror is made of 18 gold-coated hexagonal segments.",
        },
      },
      {
        kind: "chrono",
        title: "The Space Race Chain",
        intro: "Four leaps beyond the sky. Read the plaques, deduce the order, and let the teeth mesh.",
        gears: ["Sputnik 1", "Vostok 1", "Apollo 11", "Space Shuttle"],
        artifact: {
          name: "The Gagarin Compass",
          glyph: "compass",
          lore: "On 12 April 1961 Yuri Gagarin became the first person in space, completing one orbit of Earth aboard Vostok 1. The flight lasted about 108 minutes.",
        },
      },
      {
        kind: "forge",
        title: "Into the Cold Dark",
        intro: "Missions that brave the cold of space. Offer three.",
        runes: [{ sensory: "COLD" }, { domain: "SPACE" }],
        artifact: {
          name: "The Voyager Record",
          glyph: "planet",
          lore: "Voyager 1 crossed into interstellar space in 2012, the first spacecraft to do so. Each Voyager carries a gold-plated record of sounds and images from Earth.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Observatory Dial",
        intro: "Craft and discoveries circle the lens. The riddles leave only one.",
        answer: "Hubble Space Telescope",
        candidates: ["Sputnik 1", "James Webb Space Telescope", "International Space Station", "Mir", "Chandrayaan-3", "Falcon 9", "Telescope", "Galilean Moons"],
        artifact: {
          name: "The Discovery Lens",
          glyph: "lens",
          lore: "The Hubble Space Telescope launched in 1990 aboard the Space Shuttle Discovery. A flaw in its main mirror was corrected by astronauts on a servicing mission in 1993.",
        },
      },
      {
        kind: "venn",
        title: "Mission Control",
        intro: "Three rings of the space age. Place the tiles, then name any North American space mission flown by a government agency.",
        rings: ["DOMAIN_SPACE_EXPLORATION", "CREATOR_TEAM_GOVERNMENT_AGENCY", "REGION_NORTH_AMERICA"],
        tiles: ["Apollo 11", "Sputnik 1", "Falcon 9", "Interstellar", "Chandrayaan-3", "ARPANET", "Tetris"],
        brainstorm: true,
        artifact: {
          name: "The Tranquility Star",
          glyph: "star",
          lore: "Apollo 11 landed on the Moon on 20 July 1969, and Neil Armstrong and Buzz Aldrin spent about two and a half hours walking on the surface. Michael Collins orbited above in the command module Columbia.",
        },
      },
      {
        kind: "chrono",
        title: "Eyes on the Sky",
        intro: "Five patient watchers of the cosmos. Set them in the order they launched.",
        gears: ["Hubble Space Telescope", "Cassini–Huygens", "Rosetta", "Kepler Space Telescope", "James Webb Space Telescope"],
        artifact: {
          name: "The Saturn Ring",
          glyph: "planet",
          lore: "Cassini reached Saturn in 2004 and studied it for thirteen years. In 2017 it was deliberately plunged into Saturn's atmosphere to protect moons that might harbour life.",
        },
      },
      {
        kind: "forge",
        title: "Night Watchers",
        intro: "Discoveries made by watching the night sky. Offer three.",
        runes: [{ sensory: "NOCTURNAL" }, { domain: "SCI" }],
        artifact: {
          name: "The Galilean Eye",
          glyph: "eye",
          lore: "Galileo Galilei spotted four moons circling Jupiter in January 1610 with a telescope he had built himself. Io, Europa, Ganymede and Callisto are still called the Galilean moons.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Comet Dial",
        intro: "Probes and stations ring the lens. Only one chased a comet.",
        answer: "Rosetta",
        candidates: ["Gaia", "Sputnik 1", "Hayabusa", "New Horizons", "Higgs Boson", "Mir", "Tiangong Space Station"],
        artifact: {
          name: "The Philae Comet",
          glyph: "comet",
          lore: "The European Space Agency's Rosetta reached comet 67P/Churyumov–Gerasimenko in 2014 and set the Philae lander down on its surface. It was the first spacecraft to orbit a comet.",
        },
      },
    ],
  },
  {
    id: "wing-play",
    title: "Hearth & Play",
    theme: "Feasts, games and the joy of the contest.",
    chambers: [
      {
        kind: "venn",
        title: "Players of the East",
        intro: "Games and dishes, east and west. Two rings, one true home for each tile.",
        rings: ["DOMAIN_VIDEO_GAMES", "REGION_ASIA"],
        tiles: ["Super Mario Bros.", "Pokémon Red and Green", "Tetris", "Minecraft", "Sushi", "Kimchi", "Pizza", "Super Bowl"],
        artifact: {
          name: "The Famicom Star",
          glyph: "controller",
          lore: "Super Mario Bros. was released for the Famicom in Japan in 1985. Its designer, Shigeru Miyamoto, also created Donkey Kong and The Legend of Zelda.",
        },
      },
      {
        kind: "chrono",
        title: "Press Start",
        intro: "Four games that changed play. Deduce the order they reached the world.",
        gears: ["Pong", "Pac-Man", "Tetris", "Minecraft"],
        artifact: {
          name: "The Arcade Orb",
          glyph: "controller",
          lore: "Atari released Pong in 1972 after engineer Allan Alcorn built it as a training exercise. Its success helped launch the arcade video game industry.",
        },
      },
      {
        kind: "forge",
        title: "The Sweet Tooth",
        intro: "The prism craves sugar. Offer three sweet foods or treats.",
        runes: [{ sensory: "SWEET" }, { domain: "FOOD" }],
        artifact: {
          name: "The Cacao Bowl",
          glyph: "bowl",
          lore: "Cacao was prized in Mesoamerica, where the Maya and Aztecs prepared it as a bitter drink. The Aztecs even used cocoa beans as currency.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Falling-Block Dial",
        intro: "Nine games orbit the lens. One fits every riddle.",
        answer: "Tetris",
        candidates: ["Minecraft", "Pac-Man", "Space Invaders", "Pong", "Stardew Valley", "Grand Theft Auto V", "The Witcher 3: Wild Hunt", "Angry Birds"],
        artifact: {
          name: "The Pajitnov Block",
          glyph: "gear",
          lore: "Alexey Pajitnov created Tetris in 1984 at the Soviet Academy of Sciences in Moscow. Its name blends tetra, Greek for four, with tennis, his favourite sport.",
        },
      },
      {
        kind: "venn",
        title: "The Arcade Constellation",
        intro: "Three rings of play. Place the tiles, then name any game made in Asia by a team.",
        rings: ["DOMAIN_VIDEO_GAMES", "REGION_ASIA", "CREATOR_TEAM"],
        tiles: ["The Legend of Zelda", "Space Invaders", "Tetris", "Minecraft", "Sushi", "Seven Samurai", "Flappy Bird", "Paella"],
        brainstorm: true,
        artifact: {
          name: "The Invader's Crest",
          glyph: "star",
          lore: "Tomohiro Nishikado designed Space Invaders for Taito in 1978. Its aliens speed up as their numbers fall, originally a side effect of the hardware having fewer sprites to draw.",
        },
      },
      {
        kind: "chrono",
        title: "The Sporting Wheel",
        intro: "Five great contests, each with a first edition. Deduce their order.",
        gears: ["The Boat Race", "Wimbledon Championships", "Modern Olympic Games", "Tour de France", "FIFA World Cup"],
        artifact: {
          name: "The Athens Laurel",
          glyph: "leaf",
          lore: "The first modern Olympic Games were held in Athens in 1896, revived largely through the efforts of Pierre de Coubertin. Around 240 athletes from 14 nations took part.",
        },
      },
      {
        kind: "forge",
        title: "Realms of Fantasy",
        intro: "Games of swords, spells and strange kingdoms. Offer three.",
        runes: [{ facet: "FANTASY_WORK" }, { domain: "GAME" }],
        artifact: {
          name: "The Hyrule Key",
          glyph: "key",
          lore: "Shigeru Miyamoto has said The Legend of Zelda grew from his childhood explorations of the countryside around Kyoto, including the discovery of a cave. The first game launched in Japan in 1986.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Chef's Dial",
        intro: "Dishes, legends and landmarks share the dial. One answers every riddle.",
        answer: "Sushi",
        candidates: ["Pizza", "Tacos", "Amaterasu", "Great Wall of China", "Giant Panda", "Baklava", "Ceviche", "Super Mario Bros."],
        artifact: {
          name: "The Edo Bowl",
          glyph: "bowl",
          lore: "Nigiri sushi, a slice of fish pressed onto vinegared rice, became a popular fast food in Edo, now Tokyo, in the early 19th century. Older forms of sushi used fermented rice to preserve fish.",
        },
      },
    ],
  },
  {
    id: "wing-lateral",
    title: "Lateral Riddles",
    theme: "Sideways thinking, gently lit.",
    chambers: [
      {
        kind: "venn",
        title: "Gold by Night",
        intro: "Golden things and night things — and a few that are both.",
        rings: ["SENSE_GOLDEN", "SENSE_NOCTURNAL"],
        tiles: ["Voyager 1", "Café Terrace at Night", "Sunflowers", "The Starry Night", "Honey Bee", "Barn Owl", "Pizza", "Thriller"],
        artifact: {
          name: "The Arles Sun",
          glyph: "sun",
          lore: "Vincent van Gogh painted his Sunflowers series in Arles in 1888 to decorate the room of his friend Paul Gauguin. He painted further versions the following year.",
        },
      },
      {
        kind: "chrono",
        title: "Unlikely Neighbours",
        intro: "A painting, a sonata, a tower and a Moon landing. Deduce their order.",
        gears: ["Mona Lisa", "Moonlight Sonata", "Eiffel Tower", "Apollo 11"],
        artifact: {
          name: "The Iron Lattice",
          glyph: "tower",
          lore: "The Eiffel Tower was built as the entrance arch to the 1889 World's Fair in Paris. It was meant to stand for only twenty years but was kept partly because it proved useful as a radio antenna.",
        },
      },
      {
        kind: "forge",
        title: "Fire on the Tongue",
        intro: "The forge wants heat you can taste. Offer three spicy foods.",
        runes: [{ sensory: "SPICY" }, { domain: "FOOD" }],
        artifact: {
          name: "The Chilli Ember",
          glyph: "flame",
          lore: "Kimchi is Korea's fermented vegetable dish, most often made with napa cabbage and chilli. Chilli peppers reached Korea from the Americas only around the 16th or 17th century, so early kimchi was not red.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Moonlit Dial",
        intro: "Works and wonders of many kinds. The riddles leave only one.",
        answer: "Moonlight Sonata",
        candidates: ["Frankenstein", "The Starry Night", "Eiffel Tower", "Thriller", "Silent Night", "Telephone", "Messiah", "Penicillin"],
        artifact: {
          name: "The Rellstab Moon",
          glyph: "moon",
          lore: "Beethoven published his fourteenth piano sonata in 1802 as a sonata in the manner of a fantasy. The nickname Moonlight came from the critic Ludwig Rellstab after the composer's death.",
        },
      },
      {
        kind: "venn",
        title: "Cold Water Riddle",
        intro: "Water, ice and the timeless. Place the tiles, then name anything timeless tied to both cold and water.",
        rings: ["SENSE_AQUATIC", "SENSE_COLD", "TIMELESS"],
        tiles: ["Narwhal", "Titanic", "Sahara Desert", "Octopus", "Frozen", "Lake Baikal", "Mona Lisa"],
        brainstorm: true,
        artifact: {
          name: "The Narwhal Spiral",
          glyph: "spiral",
          lore: "A narwhal's tusk is an elongated tooth that can grow longer than two metres. It is packed with nerve endings and may help the whale sense its surroundings.",
        },
      },
      {
        kind: "chrono",
        title: "Leaps Across Ages",
        intro: "An epic, a craft, a powder, a novel and a game. Five gears, one order.",
        gears: ["The Odyssey", "Paper", "Gunpowder", "Don Quixote", "Minecraft"],
        artifact: {
          name: "The Cai Lun Scroll",
          glyph: "scroll",
          lore: "The Chinese court official Cai Lun reported an improved method of papermaking in 105 CE, using bark, hemp, rags and old fishing nets. Simpler forms of paper had already existed in China before him.",
        },
      },
      {
        kind: "forge",
        title: "Built on Water",
        intro: "Bridges, canals and towers by the sea. Offer three works of engineering tied to water.",
        runes: [{ sensory: "AQUATIC" }, { domain: "ENG" }],
        artifact: {
          name: "The Golden Span",
          glyph: "anchor",
          lore: "The Golden Gate Bridge opened in 1937, and its main span was the longest of any suspension bridge in the world until 1964. Its colour is officially called International Orange.",
        },
      },
      {
        kind: "astrolabe",
        title: "The Coral Dial",
        intro: "Reefs, peaks and wonders from every shore. The riddles point to one.",
        answer: "Great Barrier Reef",
        candidates: ["Sydney Opera House", "Koala", "Pele", "Galápagos Islands", "Niagara Falls", "Pavlova", "Amazon Rainforest", "Mount Fuji"],
        artifact: {
          name: "The Coral Crown",
          glyph: "fish",
          lore: "The Great Barrier Reef stretches for more than 2,300 kilometres along the coast of Queensland. It is built by billions of tiny coral polyps and is the largest coral reef system on Earth.",
        },
      },
    ],
  },
];
