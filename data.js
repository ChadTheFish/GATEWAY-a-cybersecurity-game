
const people_amount = 6; // there are 6 out of 12 people that will be checked each time played

const rules = {
  now: { date: "3026-10-11", time: "09:40" },
  clockSpeed: 1, 
  denyAt: 2, // if 2 things wrong, automaticaly wrong

  trustedIssuers: [
    "Interstellar Passport Bureau",
    "Lunar Federation Registry",
    "Mars Colonial Authority",
  ],

  trustedSeals: ["IPB-SIG-4471", "IPB-SIG-5126", "LFR-SIG-2209", "MCA-SIG-8830"],

  // LOOK AT THIS
  airlines: {
    "Nebula Airways": "https://nebulaairways.space",
    "OrbitJet": "https://orbitjet.space",
  },

  revokedTokens: ["GW-0000-TEST", "GW-9C1D-0107"],
  scannedTokens: ["GW-5E02-0109", "GW-8810-0109"],

  // REMOVE THIS BCUZ NO RELATION LOWK USELESS
  allowedPermissions: ["BOARD", "SEAT", "CARRY_ON"],

  commonWords: ["password", "qwerty", "123456", "letmein", "admin", "welcome", "iloveyou", "dragon", "abc123", "starship"],
};

// total 12 passengers. all info that they have.
const PASSENGERS = [
  {
    line: "Hi! I'm barbara. I swear I'm clean!",

    // look = colours for the tiny walking sprite in the endings (matched to the art below) - we need to remove
    look: { skin: "#f6dcc8", hair: "#f0dca0", hairStyle: "long", shirt: "#2b3a7a", eyes: "#3b6b9a" },
    image: "characters/hd/aria.png",  // character art shown in the scanner, passport and Part 2

    passport: {
      name: "Aria Antila", cipher: { type: "caesar", shift: 3 }, age: 18,
      id: "IPB-204-7781", username: "aria.antila",
      issuer: "Interstellar Passport Bureau", seal: "IPB-SIG-4471",
    },
    boarding: {
      name: "Aria Antila", id: "IPB-204-7781",
      airline: "Nebula Airways", url: "https://nebulaairways.space",
      from: "Berlin Station", to: "Tokyo Orbital",
      date: "3026-10-11", time: "12:15", gate: "A3", seat: "A4",
      password: "IL0veMyB0yfr!end", mfa: true,
      token: { code: "GW-7F3A-0109", expires: "3026-10-11 13:30" },
      permissions: ["BOARD:A3", "SEAT:A4", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "💐", name: "Freeze-Dried Roses", desc: "An anniversary gift. Vacuum-sealed so the petals survive orbit." }, // using emojis to be the luggage "items"
      { icon: "📸", name: "Photo Strip", desc: "Four tiny photos from a lunar photo booth. Aria and the boyfriend are making faces in every one." },
      { icon: "🧣", name: "Hand-Knit Scarf", desc: "Navy blue to match the coat. A little lumpy, since it was a first try." },
    ],
  },

  {
    // 2 flags (weak password, MFA off): DENY
    line: "Hiii! I'm SO late for my cousin's wedding on Europa!",
    look: { skin: "#f6e0d0", hair: "#e03a2a", hairStyle: "long", shirt: "#f0f0f0", eyes: "#3a9a3a" },
    image: "characters/hd/nova.png",
    passport: {
      name: "Nova Musca", cipher: { type: "caesar", shift: 8 }, age: 21,
      id: "LFR-550-1093", username: "novamusca",
      issuer: "Lunar Federation Registry", seal: "LFR-SIG-2209",
    },
    boarding: {
      name: "Nova Musca", id: "LFR-550-1093",
      airline: "OrbitJet", url: "https://orbitjet.space",
      from: "Luna Port", to: "Europa Dock",
      date: "3026-10-11", time: "12:50", gate: "B1", seat: "C2",
      password: "nova3000", mfa: false,
      token: { code: "GW-22B8-0109", expires: "3026-10-11 13:30" },
      permissions: ["BOARD:B1", "SEAT:C2", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "🎤", name: "Toast Cards", desc: "Cue cards for the wedding toast. Card 3 just says \"DON'T CRY.\"" },
      { icon: "🩹", name: "Sparkly Eyepatch", desc: "A glittery spare, saved for the wedding photos." },
      { icon: "🎁", name: "Wedding Gift", desc: "Hand-painted teacups wrapped in starfoil. The tag says \"From Nova, sorry I'm late.\"" },
    ],
  },

  {
    // 3 flags (photo, username, keycard): DENY
    line: "Name's Norma. Just stamp it. I've done this a hundred times.",
    look: { skin: "#f6e0d0", hair: "#4a50a8", hairStyle: "short", shirt: "#3a3a40", eyes: "#d06a2a" },
    image: "characters/hd/kai.png",
    passport: {
      name: "Norma Taurus", cipher: { type: "caesar", shift: 1 }, age: 27,
      id: "MCA-310-6624", username: "xX_bull_Xx",
      issuer: "Mars Colonial Authority", seal: "MCA-SIG-8830",
      // Impostor: the passport photo is a different person (same face shape, brown hair instead of blue)
      photo: { hair: "#8a6a3a" },
      photoImage: "characters/hd/kai-passport.png",
    },
    boarding: {
      name: "Norma Taurus", id: "MCA-310-6624",
      airline: "Nebula Airways", url: "https://nebulaairways.space",
      from: "Olympus Base", to: "Ceres Hub",
      date: "3026-10-11", time: "12:05", gate: "A1", seat: "F9",
      password: "Blu3&0range=F1r3C0mb0", mfa: true,
      token: { code: "GW-41D0-0109", expires: "3026-10-11 14:00" },
      permissions: ["BOARD:A1", "SEAT:F9", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "🪪", name: "Crew Keycard", desc: "Cloned from a pilot's badge, with a little bull sticker on the back. Label reads: \"Opens any door marked STAFF ONLY.\"", suspicious: true },
      { icon: "🐂", name: "Bull Keychain", desc: "A tiny Taurus charm. It isn't holding any keys." },
      { icon: "🧥", name: "Spare Jacket", desc: "A plain grey jacket, the exact same as the one being worn right now." },
    ],
  },

  {
    // 0 flags, but the data crystal looks scary: APPROVE
    line: "Heading to the Titan Ring robotics expo.",
    look: { skin: "#a8806a", hair: "#c0d8ec", hairStyle: "short", shirt: "#4a4448", eyes: "#c09030" },
    image: "characters/hd/priya.png",
    passport: {
      name: "Draco Alphard", cipher: { type: "caesar", shift: 10 }, age: 29,
      id: "IPB-771-3350", username: "malfoid",
      issuer: "Interstellar Passport Bureau", seal: "IPB-SIG-5126",
    },
    boarding: {
      name: "Draco Alphard", id: "IPB-771-3350",
      airline: "OrbitJet", url: "https://orbitjet.space",
      from: "Berlin Station", to: "Titan Ring",
      date: "3026-10-11", time: "13:40", gate: "C4", seat: "B7",
      password: "!H4at3P0tt3r>:(", mfa: true,
      token: { code: "GW-90AE-0109", expires: "3026-10-11 14:30" },
      permissions: ["BOARD:C4", "SEAT:B7", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "🔷", name: "Data Crystal (sealed)", desc: "Label: \"Robot blueprints backup. Read-only. Personal files only.\" Scans show no executable code." },
      { icon: "🤖", name: "Tiny Robot Arm", desc: "The expo demo model, painted green and silver. Battery removed, as required." },
      { icon: "🪴", name: "Plant", desc: "A small potted plant." },
    ],
  },

  {
    // 4 flags (fake issuer, forged seal, phishing URL, phishing letters): DENY
    line: "Good day. Everything is in order, I assure you. Very official. Please hurry, I have a concert to catch!",
    look: { skin: "#f6e0d0", hair: "#f0e0b0", hairStyle: "short", shirt: "#3a3636", eyes: "#7a5ab0", accessory: "glasses" },
    image: "characters/hd/theo.png",
    passport: {
      name: "Luca Cepheus", cipher: { type: "caesar", shift: 5 }, age: 34,
      id: "IPB-118-9043", username: "HyunaLover67",
      issuer: "Interstellar Passport Bureu", seal: "IPB-SIG-4417",
    },
    boarding: {
      name: "Luca Cepheus", id: "IPB-118-9043",
      airline: "Nebula Airways", url: "https://nebulaairways-checkin.co",
      from: "Tokyo Orbital", to: "Mars Gate",
      date: "3026-10-11", time: "12:40", gate: "A2", seat: "D1",
      password: "!L!k3G3tt!ngCl0n3d", mfa: true,
      token: { code: "GW-6B17-0109", expires: "3026-10-11 13:40" },
      permissions: ["BOARD:A2", "SEAT:D1", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "📨", name: "Stack of 200 Letters", desc: "All identical: \"URGENT: Your Nebula account is locked! Verify your password at nebulaairways-checkin.co\"", suspicious: true },
      { icon: "🪄", name: "Concert Lightstick", desc: "Glows in fan colours. Batteries removed for the flight." },
      { icon: "🎩", name: "Top Hat", desc: "Very fancy. Very official. Very empty." },
    ],
  },

  {
    // 3 flags (duplicate token, admin permission, data crystal): DENY
    line: "Hey there. Just a quick hop to the Ceres mining station. Don't mind the crystal.",
    look: { skin: "#8a5a40", hair: "#f0f0f0", hairStyle: "long", shirt: "#c8c8c8", eyes: "#c03030" },
    image: "characters/hd/mira.png",
    passport: {
      name: "Hydra Pollux", cipher: { type: "caesar", shift: 4 }, age: 22,
      id: "LFR-402-7718", username: "hydra_pollux",
      issuer: "Lunar Federation Registry", seal: "LFR-SIG-2209",
    },
    boarding: {
      name: "Hydra Pollux", id: "LFR-402-7718",
      airline: "Nebula Airways", url: "https://nebulaairways.space",
      from: "Luna Port", to: "Ceres Hub",
      date: "3026-10-11", time: "13:15", gate: "A3", seat: "A5",
      password: "3he4dedm0nster!", mfa: true,
      token: { code: "GW-5E02-0109", expires: "3026-10-11 14:00" },
      permissions: ["BOARD:A3", "SEAT:A5", "CARRY_ON:1", "BAGGAGE_SYS:ADMIN"],
    },
    luggage: [
      { icon: "🔮", name: "Data Crystal", desc: "Only activates after gaining access to restricted files. Glows brighter near airport terminals.", suspicious: true },
      { icon: "🐉", name: "Three-Headed Plushie", desc: "A dragon plush with three heads. Each head has its own name!" },
      { icon: "💠", name: "Shining Crystal", desc: "Just a glistening piece of rock."},
    ],
  },

  {
    // 3 flags (name, ID, flight already left): DENY
    line: "Name's Anaxagoras. Am I late? I lost track of time.",
    look: { skin: "#f6e0d0", hair: "#7a9a70", hairStyle: "long", shirt: "#f0f0f0", eyes: "#6a9ad0" },
    image: "characters/hd/zed.png",
    passport: {
      name: "Alessandro Peal", cipher: { type: "caesar", shift: 7 }, age: 22,
      id: "MCA-881-2045", username: "zhalloway",
      issuer: "Mars Colonial Authority", seal: "MCA-SIG-8830",
    },
    boarding: {
      name: "Anaxagoras Vela", id: "MCA-118-2045",
      airline: "OrbitJet", url: "https://orbitjet.space",
      from: "Mars Gate", to: "Venus Cloud City",
      date: "3026-10-11", time: "08:30", gate: "B3", seat: "E2",
      password: "P!1os0phyRu1es", mfa: true,
      token: { code: "GW-3C55-0109", expires: "3026-10-11 14:00" },
      permissions: ["BOARD:B3", "SEAT:E2", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "📚", name: "Pocket Philosophy Book", desc: "\"Everything contains a portion of everything.\" Almost every page is highlighted." },
      { icon: "🧭", name: "Broken Compass", desc: "Points wherever it feels like. A sticky note says \"it's a metaphor.\"" },
    ],
  },

  {
    // 0 flags: APPROVE
    line: "Hi! Going home to my moon-cat, Mochi. Please don't ask about Barbara.",
    look: { skin: "#f6dcc8", hair: "#4a4040", hairStyle: "long", shirt: "#a8c8f0", eyes: "#2b2d5c" },
    image: "characters/hd/ada.png",
    passport: {
      name: "Jenny Aquarius", cipher: { type: "caesar", shift: 13 }, age: 23,
      id: "LFR-613-2290", username: "1BarbaraHater",
      issuer: "Lunar Federation Registry", seal: "LFR-SIG-2209",
    },
    boarding: {
      name: "Jenny Aquarius", id: "LFR-613-2290",
      airline: "OrbitJet", url: "https://orbitjet.space",
      from: "Venus Cloud City", to: "Luna Port",
      date: "3026-10-11", time: "14:20", gate: "B2", seat: "A1",
      password: "F4ad!ngBarbar4", mfa: true,
      token: { code: "GW-A1C4-0109", expires: "3026-10-11 15:00" },
      permissions: ["BOARD:B2", "SEAT:A1", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "🐟", name: "Cat Treats", desc: "Freeze-dried space tuna for Mochi. Sealed and agri-cleared." },
      { icon: "🏺", name: "Aquarius Charm", desc: "A tiny water-bearer charm on a beaded bracelet." },
      { icon: "📝", name: "Crumpled Note", desc: "A list titled \"Why Barbara sucks.\" It goes on for three pages." },
    ],
  },

  {
    // 1 flag (MFA off): only one, so APPROVE
    line: "...",
    look: { skin: "#f6e0d0", hair: "#3a3434", hairStyle: "long", shirt: "#2e2e32", eyes: "#5a5a60" },
    image: "characters/hd/oscar.png",
    passport: {
      name: "Oscar Sirius", cipher: { type: "caesar", shift: 2 }, age: 58,
      id: "MCA-204-5571", username: "oscar.sirius",
      issuer: "Mars Colonial Authority", seal: "MCA-SIG-8830",
    },
    boarding: {
      name: "Oscar Sirius", id: "MCA-204-5571",
      airline: "Nebula Airways", url: "https://nebulaairways.space",
      from: "Ceres Hub", to: "Mars Gate",
      date: "3026-10-11", time: "12:30", gate: "A6", seat: "C3",
      password: "SuperNonchalant7!", mfa: false,
      token: { code: "GW-B7E2-0109", expires: "3026-10-11 14:00" },
      permissions: ["BOARD:A6", "SEAT:C3", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "🌟", name: "Star Chart", desc: "A hand-drawn map of Sirius, the Dog Star, the brightest star in the sky. Well-worn at the folds." },
      { icon: "🐕", name: "Old Photo", desc: "A faded photo of a fluffy dog, named Sirius JR." },
      { icon: "☕", name: "Coffee", desc: "A necessity to life." },
    ],
  },

  {
    // 1 flag (password has their birth year, 3026 - 40 = 2986): only one, so APPROVE
    line: "Hello, dear! Off to paint the sunflower fields on Titan. I'm an artist, you see.",
    look: { skin: "#9a6a50", hair: "#f0e0b0", hairStyle: "short", shirt: "#d8a040", eyes: "#6a2a3a" },
    image: "characters/hd/rosa.png",
    passport: {
      name: "Castillo Mae", cipher: { type: "caesar", shift: 11 }, age: 40,
      id: "IPB-330-1182", username: "castingmae",
      issuer: "Interstellar Passport Bureau", seal: "IPB-SIG-4471",
    },
    boarding: {
      name: "Castillo Mae", id: "IPB-330-1182",
      airline: "OrbitJet", url: "https://orbitjet.space",
      from: "Earth Spaceport", to: "Titan Ring",
      date: "3026-10-11", time: "13:05", gate: "C1", seat: "D4",
      password: "TheArtist2689", mfa: true,
      token: { code: "GW-C3D9-0109", expires: "3026-10-11 14:30" },
      permissions: ["BOARD:C1", "SEAT:D4", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "🎨", name: "Paint Set", desc: "Twelve space-safe paints. Eight of them are shades of yellow." },
      { icon: "🌻", name: "Pressed Sunflower", desc: "Kept between two sheets of glass. A reference for the painting." },
      { icon: "🖼️", name: "Rolled Canvas", desc: "Blank for now. Labelled \"Masterpiece #2689.\"" },
    ],
  },

  {
    // 2 flags (yesterday's flight, expired token): DENY
    line: "Wait, my flight's today, right? ...Right? I was at a concert all night.",
    look: { skin: "#f6e0d0", hair: "#8a6a58", hairStyle: "short", shirt: "#3a3636", eyes: "#8a4ad0" },
    image: "characters/hd/juno.png",
    passport: {
      name: "Leo Juno", cipher: { type: "caesar", shift: 6 }, age: 19,
      id: "LFR-778-0045", username: "junoleo",
      issuer: "Lunar Federation Registry", seal: "LFR-SIG-2209",
    },
    boarding: {
      name: "Leo Juno", id: "LFR-778-0045",
      airline: "Nebula Airways", url: "https://nebulaairways.space",
      from: "Luna Port", to: "Saturn Station",
      date: "3026-10-10", time: "15:00", gate: "A4", seat: "B2",
      password: "sw4agge$stTh!fter", mfa: true,
      token: { code: "GW-D4F1-0108", expires: "3026-10-10 16:00" },
      permissions: ["BOARD:A4", "SEAT:B2", "CARRY_ON:1"],
    },
    luggage: [
      { icon: "🎸", name: "Mini Space Guitar", desc: "Covered in friendship bracelets. Strings slightly out of tune." },
      { icon: "🎟️", name: "Concert Ticket Stub", desc: "From last night's show. Dated yesterday, just like a certain boarding pass." },
      { icon: "🍙", name: "Rice Balls", desc: "Three of them, wrapped in seaweed. Breakfast, apparently." },
    ],
  },

  {
    // 2 flags (cockpit access, malware floppy): DENY
    line: "I'm a pilot, actually. Well, sort of. I'll just sit up front, near the controls.",
    look: { skin: "#a87a5a", hair: "#4a4040", hairStyle: "spiky", shirt: "#4a4a4a", eyes: "#e0b020" },
    image: "characters/hd/felix.png",
    passport: {
      name: "Phoenix Zosma", cipher: { type: "caesar", shift: 9 }, age: 37,
      id: "IPB-905-6613", username: "Firey.Zosma",
      issuer: "Interstellar Passport Bureau", seal: "IPB-SIG-5126",
    },
    boarding: {
      name: "Phoenix Zosma", id: "IPB-905-6613",
      airline: "OrbitJet", url: "https://orbitjet.space",
      from: "Mars Gate", to: "Earth Spaceport",
      date: "3026-10-11", time: "12:55", gate: "B4", seat: "F1",
      password: "Gr44kG44k!", mfa: true,
      token: { code: "GW-E8A0-0109", expires: "3026-10-11 14:00" },
      permissions: ["BOARD:B4", "SEAT:F1", "CARRY_ON:1", "COCKPIT:ALL"],
    },
    luggage: [
      { icon: "💾", name: "Floppy Disk", desc: "Labelled AUTO_RUN.exe. \"Installs itself on any port it touches.\"", suspicious: true },
      { icon: "🪶", name: "Phoenix Feather", desc: "A bright orange feather. Probably dyed. Definitely not on fire." },
      { icon: "🧢", name: "Pilot Cap", desc: "Bought at the spaceport gift shop. The price tag is still on." },
    ],
  },
];
