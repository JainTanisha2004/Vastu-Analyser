"""Vastu Shastra Curated Knowledge Base and Deterministic Retrieval Layer.

This module contains authentic Vastu Shastra principles, element mappings,
direction significance, room guidelines, and curated non-destructive remedies.
It serves as the grounded retrieval component (R in RAG) for report generation
and conversational Q&A without vector hallucination.
"""

from typing import Any, Dict, List, Optional


DIRECTION_SIGNIFICANCE: Dict[str, Dict[str, str]] = {
    "N": {
        "name": "North (Uttara)",
        "ruling_planet": "Mercury (Budha)",
        "element": "Water (Jal)",
        "deity": "Lord Kubera (Treasurer of the Gods)",
        "energy": "Magnetic, cooling, receptive",
        "life_areas": "Wealth accumulation, career growth, financial inflows, business opportunities",
        "recommendations": "Keep open, light, clean. Favorable for main door, living, treasury, study.",
    },
    "NE": {
        "name": "North-East (Ishanya)",
        "ruling_planet": "Jupiter (Guru)",
        "element": "Water (Jal) & Space (Akasha)",
        "deity": "Lord Shiva (Ishana) / Cosmic Energy Gateway",
        "energy": "Most sacred, highly sensitive, positive vibrational vortex",
        "life_areas": "Spiritual growth, mental clarity, wisdom, peace of mind, family harmony",
        "recommendations": "Must remain the lightest, cleanest sector. Ideal for Mandir, meditation, water bodies. Strictly avoid toilets, kitchen, and heavy staircases.",
    },
    "E": {
        "name": "East (Poorva)",
        "ruling_planet": "Sun (Surya)",
        "element": "Air (Vayu) & Prana",
        "deity": "Lord Indra (King of Devas)",
        "energy": "Solar, invigorating, life-giving",
        "life_areas": "Health, vitality, social status, government connections, new beginnings",
        "recommendations": "Allow ample morning sunlight. Good for main entrance, living room, study, balconies.",
    },
    "SE": {
        "name": "South-East (Agneya)",
        "ruling_planet": "Venus (Shukra)",
        "element": "Fire (Agni)",
        "deity": "Lord Agni (Fire God)",
        "energy": "Dynamic, transformative, metabolic",
        "life_areas": "Cash liquidity, physical vigor, digestion, passion, female health",
        "recommendations": "Primary seat for fire activities. Ideal for Kitchen, electrical mains, furnace. Strictly avoid water bodies or master bedroom.",
    },
    "S": {
        "name": "South (Dakshina)",
        "ruling_planet": "Mars (Mangala)",
        "element": "Fire (Agni) & Earth (Prithvi)",
        "deity": "Lord Yama (Dharma & Justice)",
        "energy": "Grounding, resting, protective",
        "life_areas": "Fame, reputation, restful sleep, courage, longevity",
        "recommendations": "Keep moderately heavy and closed. Suitable for bedrooms, staircase, storage.",
    },
    "SW": {
        "name": "South-West (Nairutya)",
        "ruling_planet": "Rahu",
        "element": "Earth (Prithvi)",
        "deity": "Nirriti / Lord of Stability",
        "energy": "Heaviest, most magnetic, authoritative, grounding",
        "life_areas": "Family leadership, financial stability, relationship strength, career mastery",
        "recommendations": "Must be the heaviest, tallest zone. Ideal for Master Bedroom and heavy storage. Strictly avoid entrances, toilets, underground water, and temples.",
    },
    "W": {
        "name": "West (Pashchima)",
        "ruling_planet": "Saturn (Shani)",
        "element": "Space (Akasha) & Air (Vayu)",
        "deity": "Lord Varuna (God of Waters and Oceans)",
        "energy": "Consolidating, maturing, harvesting",
        "life_areas": "Profits, career gains, fulfillment of desires, academic success",
        "recommendations": "Moderate weight. Favorable for dining room, children's study, overhead water tanks, toilets.",
    },
    "NW": {
        "name": "North-West (Vayavya)",
        "ruling_planet": "Moon (Chandra)",
        "element": "Air (Vayu)",
        "deity": "Lord Vayu (Wind God)",
        "energy": "Kinetic, changing, social, transient",
        "life_areas": "Support from helpful friends, travel, trade, relationships, mobility",
        "recommendations": "Dynamic movement zone. Suitable for Guest Bedroom, toilets, utility wash, vehicles.",
    },
    "Center": {
        "name": "Center (Brahmasthan)",
        "ruling_planet": "None (Universal Axis)",
        "element": "Space (Akasha)",
        "deity": "Lord Brahma (Creator)",
        "energy": "Zero-point cosmic energy vortex",
        "life_areas": "Core life vitality, overall well-being and structural balance",
        "recommendations": "Must be completely open, free of pillars, heavy furniture, beams, and toilets.",
    },
}

ROOM_SIGNIFICANCE: Dict[str, Dict[str, str]] = {
    "Kitchen": {
        "element": "Fire (Agni)",
        "importance": "The hearth governs family health, nourishment, and monetary liquidity.",
        "best_zones": "SE (Agneya, ideal), S (good secondary), E (acceptable).",
        "worst_zones": "NE (Water-Fire clash destroying health and finances), SW (destroys stability), N.",
    },
    "Main Door": {
        "element": "Prana / Cosmic Conduit",
        "importance": "The mouth of the house through which cosmic energy and prosperity enter.",
        "best_zones": "NE, N, E (auspicious padas for wealth, health, and enlightenment).",
        "worst_zones": "SW (brings sudden losses and disputes), S, SE.",
    },
    "Foyer": {
        "element": "Transition Buffer",
        "importance": "Welcoming vestibule that filters incoming street energy before entering main living spaces.",
        "best_zones": "N, E, NE.",
        "worst_zones": "SW.",
    },
    "Master Bedroom": {
        "element": "Earth (Prithvi - Heavy & Grounding)",
        "importance": "Seat of the primary breadwinner; dictates authority, decision-making, and marital harmony.",
        "best_zones": "SW (Nairutya - utmost stability), S, W.",
        "worst_zones": "NE (Ishaan - leads to restlessness, insomnia, anxiety), SE (irritability and disputes).",
    },
    "Toilet": {
        "element": "Disposal & Negative Energy Outlet",
        "importance": "Flushes toxins; improper placement drains the positive cosmic energies of sacred sectors.",
        "best_zones": "NW (air cleanses odors), W, S.",
        "worst_zones": "NE (catastrophic Ishaan dosha destroying mental peace, lineage, health), SW.",
    },
    "Mandir": {
        "element": "Divine / Sattva (Pure Spirit)",
        "importance": "The energetic heart of spiritual blessing and high-frequency cosmic resonance.",
        "best_zones": "NE (Ishanya - cosmic corner), E, N.",
        "worst_zones": "S, SW (inauspicious), under staircases, or adjoining toilets.",
    },
    "Staircase": {
        "element": "Earth / Heavy Load",
        "importance": "Exerts tremendous vertical load; must anchor heavy zones and avoid blocking light sectors.",
        "best_zones": "SW, S, W (clockwise ascending).",
        "worst_zones": "NE (severely suppresses positive solar and magnetic currents), Center.",
    },
    "Living": {
        "element": "Air & Ether (Expansive Social Energy)",
        "importance": "Receives guests, fosters family bonding, and circulates vital social prana.",
        "best_zones": "N, E, NE, NW.",
        "worst_zones": "SW (can trigger argumentative social vibes).",
    },
    "Dining": {
        "element": "Earth & Fire (Assimilation)",
        "importance": "Nourishment assimilation, family togetherness, and satisfaction of appetite.",
        "best_zones": "W (fulfillment zone), NW, E.",
        "worst_zones": "SW.",
    },
    "Kids Bedroom": {
        "element": "Air & Water (Intellect and Growth)",
        "importance": "Nurtures cognitive growth, concentration, academic performance, and sound rest.",
        "best_zones": "NW, E, NE, N.",
        "worst_zones": "SW (makes children rebellious and domineering).",
    },
    "Guest": {
        "element": "Air (Vayu - Transient Movement)",
        "importance": "Ensures hospitality and comfort while preventing guests from overstaying.",
        "best_zones": "NW (Vayavya - realm of motion), E, N.",
        "worst_zones": "SW (guests may dominate or stay indefinitely).",
    },
    "Elders Bedroom": {
        "element": "Earth (Prithvi - Serenity & Respect)",
        "importance": "Promotes peaceful retirement, dignified rest, and protective blessings for family.",
        "best_zones": "SW, S, W.",
        "worst_zones": "SE (excess heat causes hypertension and agitation).",
    },
    "Wash": {
        "element": "Water & Drainage (Utility)",
        "importance": "Removal of dirt and dirty water; handling appliances and wet operations.",
        "best_zones": "SE, NW, E.",
        "worst_zones": "NE (pollutes spiritual clarity).",
    },
    "Balcony": {
        "element": "Ether & Light (Prana Intake)",
        "importance": "Invites early morning infrared sunlight and fresh north-easterly breezes.",
        "best_zones": "N, E, NE.",
        "worst_zones": "SW, S (excessive solar radiation without beneficial magnetic field).",
    },
}

VASTU_KNOWLEDGE: Dict[str, Dict[str, Dict[str, str]]] = {
    "Kitchen": {
        "SE": {
            "evaluation": "Ideal & Highly Auspicious",
            "significance": "Located in Agneya (ruled by Agni Dev), the natural quadrant of fire. Cooking here infuses food with vital prana, ensures robust family health, and supports strong financial cash flow.",
            "elemental_harmony": "Perfect fire-element balance (Agni in Agni-sthāna).",
            "impact": "Fosters longevity, vibrant metabolic health, and financial security.",
        },
        "S": {
            "evaluation": "Favorable Secondary Choice",
            "significance": "South shares the fire element with SE. Cooking facing East here remains productive and energetically sound.",
            "elemental_harmony": "Good fire synergy.",
            "impact": "Stable finances and steady family energy.",
        },
        "E": {
            "evaluation": "Acceptable / Neutral",
            "significance": "East is ruled by Sun and Air. While acceptable, kitchen activity here benefits from morning solar radiation.",
            "elemental_harmony": "Air feeds fire harmoniously.",
            "impact": "Moderate health and active family environment.",
        },
        "NE": {
            "evaluation": "Highly Inauspicious (Severe Fire-Water Clash)",
            "significance": "Placing the kitchen in Ishanya (NE - sacred water/ether corner) pits Fire against Water. This creates internal strife, digestive ailments, chronic medical expenses, and emotional irritability.",
            "elemental_harmony": "Severe conflict: Agni (Fire) consumes Jal (Water).",
            "impact": "High medical expenses, strained relationships, and loss of peace.",
        },
        "SW": {
            "evaluation": "Unfavourable (Earth-Fire Distortion)",
            "significance": "South-West demands heavy, static earth energy. Introducing active fire here destabilizes the home owner's authority and causes financial drain.",
            "elemental_harmony": "Fire scorches Earth.",
            "impact": "Erosion of authority, marital friction, and unexpected expenditures.",
        },
        "NW": {
            "evaluation": "Acceptable Alternative (Vayavya Kitchen)",
            "significance": "Second best alternative when SE is unavailable. Air element aids fire, though expenses can fluctuate if not balanced.",
            "elemental_harmony": "Air supporting Fire.",
            "impact": "Good vitality, slight tendency toward rapid expenditures.",
        },
    },
    "Master Bedroom": {
        "SW": {
            "evaluation": "Perfect & Highly Auspicious",
            "significance": "Nairutya is ruled by Earth and Rahu, offering maximum stability, weight, and grounding. Sleeping here anchors the head of the house, establishes firm decision-making, and cements marital fidelity.",
            "elemental_harmony": "Earth element anchors human stability.",
            "impact": "Financial stability, family leadership, emotional security, and restorative sleep.",
        },
        "S": {
            "evaluation": "Favorable & Grounding",
            "significance": "South provides strong stability and deep restful sleep, especially when sleeping with the head pointed South.",
            "elemental_harmony": "Earth-fire grounded composure.",
            "impact": "Steady career progress and sound sleep.",
        },
        "W": {
            "evaluation": "Good & Favorable",
            "significance": "West is ruled by Saturn/Varuna, supporting prosperity, career consolidation, and mature decision-making.",
            "elemental_harmony": "Space and consolidation.",
            "impact": "Financial gains and steady household management.",
        },
        "NE": {
            "evaluation": "Severely Inauspicious",
            "significance": "North-East is the meditative Ishaan corner meant for spiritual pursuit, not physical intimacy or heavy master bed weight. Placing the master bedroom here causes sleep deprivation, constant restlessness, and financial instability.",
            "elemental_harmony": "Heavy human load violates delicate Ishanya ether.",
            "impact": "Insomnia, anxiety, mental fog, and ungrounded decision making.",
        },
        "SE": {
            "evaluation": "Unfavourable (Agni Irritation)",
            "significance": "Sleeping in the fire zone increases temper, blood pressure, and marital arguments.",
            "elemental_harmony": "Excessive heat disturbs bodily Pitta.",
            "impact": "Frequent bickering, elevated stress, and disturbed sleep.",
        },
        "NW": {
            "evaluation": "Moderate / Unstable for Master",
            "significance": "NW is governed by the wind element (movement). The head of the family may feel unstable or constantly traveling.",
            "elemental_harmony": "Air element causes fluctuation.",
            "impact": "Restlessness and inconsistent focus.",
        },
    },
    "Main Door": {
        "NE": {
            "evaluation": "Supreme Auspiciousness (Amrita Pada)",
            "significance": "Welcomes positive cosmic vibrations, magnetic currents, and solar energy directly into the residence. Brings intellectual prosperity, divine grace, and effortless growth.",
            "elemental_harmony": "Pure cosmic gateway.",
            "impact": "Abundance, family harmony, spiritual growth, and high opportunities.",
        },
        "N": {
            "evaluation": "Highly Auspicious (Kubera Door)",
            "significance": "North entrance attracts the blessings of Lord Kubera, the custodian of celestial wealth. Boosts business, career promotions, and steady liquidity.",
            "elemental_harmony": "Water/magnetic prosperity flow.",
            "impact": "Lucrative career opportunities, consistent wealth, and commercial success.",
        },
        "E": {
            "evaluation": "Highly Auspicious (Indra / Surya Door)",
            "significance": "Direct alignment with the rising Sun. Brings vibrant health, social honor, leadership status, and enlightenment.",
            "elemental_harmony": "Solar energy infuses life.",
            "impact": "Vitality, prestige, social respect, and vitality.",
        },
        "SW": {
            "evaluation": "Critically Inauspicious",
            "significance": "SW is the exit zone for negative energies and must remain shut and heavy. Opening a main door here allows accumulated wealth to dissipate and invites recurring hardships and accidents.",
            "elemental_harmony": "Severe violation of earth stability.",
            "impact": "Financial losses, legal disputes, chronic stress, and instability.",
        },
        "SE": {
            "evaluation": "Unfavourable",
            "significance": "Fire entrance can trigger friction with visitors, legal issues, or sudden financial drain.",
            "elemental_harmony": "Excessive volatile fire prana.",
            "impact": "Agitation and volatile income.",
        },
    },
    "Toilet": {
        "NW": {
            "evaluation": "Ideal & Highly Auspicious",
            "significance": "Vayavya (NW) is governed by the wind element. Waste and negative energies are swiftly eliminated and blown away without lingering in the living quarters.",
            "elemental_harmony": "Wind carries away impurities naturally.",
            "impact": "Proper detoxification, mental lightness, and unhindered health.",
        },
        "W": {
            "evaluation": "Favorable & Recommended",
            "significance": "West is associated with Varuna and drainage. Toilets in the West dispose of negative energies effectively.",
            "elemental_harmony": "Effective drainage conduit.",
            "impact": "Good sanitation balance without negative Vastu repercussions.",
        },
        "S": {
            "evaluation": "Acceptable Placement",
            "significance": "Acceptable in South-South-East or South zones if properly ventilated and kept neat.",
            "elemental_harmony": "Neutral impact.",
            "impact": "Minimal negative interference.",
        },
        "NE": {
            "evaluation": "Extremely Critical Dosha (Ishaan Toilet)",
            "significance": "Considered the single most severe defect in Vastu Shastra. Placing a toilet in the sacred Ishanya quadrant pollutes the home's spiritual fountainhead. It leads to persistent neurological or psychological issues, heavy debts, and stunted progress.",
            "elemental_harmony": "Toxic disposal directly desecrating the divine ether.",
            "impact": "Severe mental anguish, chronic ailments, educational hurdles for children, and loss of prosperity.",
        },
        "SW": {
            "evaluation": "Severe Dosha",
            "significance": "Drains the grounding stability of the house. Weakens family bonds and leadership.",
            "elemental_harmony": "Draining the earth foundation.",
            "impact": "Chronic instability, career stagnation, and marital friction.",
        },
    },
    "Mandir": {
        "NE": {
            "evaluation": "Supreme & Ideal Placement",
            "significance": "Ishanya is the abode of cosmic consciousness. Prayers offered here resonate with maximum divine energy, cultivating immense inner peace and spiritual radiance.",
            "elemental_harmony": "Direct resonance with cosmic sattva.",
            "impact": "Spiritual elevation, clarity of intellect, family serenity, and divine grace.",
        },
        "E": {
            "evaluation": "Very Auspicious",
            "significance": "Facing East during prayer connects the worshipper with solar prana and auspicious beginnings.",
            "elemental_harmony": "Solar vitality.",
            "impact": "Healthy body, enlightened mind, and noble thoughts.",
        },
        "N": {
            "evaluation": "Very Auspicious",
            "significance": "North mandir invokes Kubera and Vishnu, bringing prosperity and ethical wealth.",
            "elemental_harmony": "Magnetic prosperity.",
            "impact": "Financial blessings and ethical success.",
        },
        "S": {
            "evaluation": "Inauspicious",
            "significance": "South direction is governed by Yama and Tamasic energy; unsuitable for deity installation.",
            "elemental_harmony": "Clash between spiritual devotion and heavy grounding.",
            "impact": "Dullness in spiritual practice, lack of devotional focus.",
        },
        "SW": {
            "evaluation": "Severely Inauspicious",
            "significance": "SW is the heavy Nairutya sector ruled by Rahu/Earth; inappropriate for Sattvic worship.",
            "elemental_harmony": "Incompatible energy frequencies.",
            "impact": "Lack of devotional benefits and domestic discord.",
        },
    },
    "Staircase": {
        "SW": {
            "evaluation": "Ideal & Highly Recommended",
            "significance": "The massive vertical weight of a staircase naturally provides the exact heavy load required in Nairutya, solidifying structural stability.",
            "elemental_harmony": "Heavy mass matches Earth quadrant requirements.",
            "impact": "Anchored wealth, enduring prestige, and structural safety.",
        },
        "S": {
            "evaluation": "Favorable & Auspicious",
            "significance": "South handles structural weight smoothly, protecting the northern zones.",
            "elemental_harmony": "Grounded weight distribution.",
            "impact": "Protection and steady achievements.",
        },
        "W": {
            "evaluation": "Favorable",
            "significance": "Provides suitable weight in the Western quadrant.",
            "elemental_harmony": "Harmonious weight balance.",
            "impact": "Consistent professional growth.",
        },
        "NE": {
            "evaluation": "Severely Defective",
            "significance": "Placing a heavy staircase in North-East suffocates the sacred energy receiver of the house, causing persistent hardship.",
            "elemental_harmony": "Excessive mass crushing delicate light-receiving ether.",
            "impact": "Financial blockages, chronic headaches, and lack of clarity.",
        },
    },
}

REMEDIES: Dict[str, Dict[str, List[Dict[str, str]]]] = {
    "Kitchen": {
        "NE": [
            {
                "type": "color",
                "severity": "immediate",
                "title": "Color Harmonization",
                "description": "Paint the kitchen walls in light green, mint, or pastel cream. Avoid all shades of red, pink, or orange which exacerbate the fire-water clash.",
            },
            {
                "type": "object",
                "severity": "recommended",
                "title": "Zinc Vastu Helix & Crystal Pyramid",
                "description": "Install a Zinc Vastu Helix and a clear quartz crystal or green aventurine slab beneath the gas stove to absorb conflicting thermal vibrations.",
            },
            {
                "type": "plant",
                "severity": "recommended",
                "title": "Air & Water Botanical Buffers",
                "description": "Place healthy indoor bamboo or money plant in water in the kitchen corner to bridge Fire and Water elements through the wood element.",
            },
            {
                "type": "orientation",
                "severity": "recommended",
                "title": "Cooking Direction Adjustment",
                "description": "Ensure the cook faces East while cooking. Keep cooking stove and water sink as far apart as possible.",
            },
        ],
        "SW": [
            {
                "type": "color",
                "severity": "immediate",
                "title": "Earth Tone Balancing",
                "description": "Incorporate yellow, beige, or warm sandstone colors. Place a yellow jaisalmer stone slab under the cooking stove.",
            },
            {
                "type": "object",
                "severity": "recommended",
                "title": "Lead Pyramid Installation",
                "description": "Place three Lead Vastu Pyramids in the SW corners to reinforce the heavy earth foundation compromised by the fire.",
            },
        ],
        "N": [
            {
                "type": "color",
                "severity": "immediate",
                "title": "Green Emerald Shading",
                "description": "Use sage green countertop or kitchen mat to mitigate the water-fire opposition.",
            },
            {
                "type": "object",
                "severity": "recommended",
                "title": "Copper Swastik",
                "description": "Mount an energized Copper Swastik on the southern kitchen wall.",
            },
        ],
    },
    "Master Bedroom": {
        "NE": [
            {
                "type": "color",
                "severity": "immediate",
                "title": "Soothing Color Palette",
                "description": "Use pale ivory, soft sky blue, or light cream for walls and bed linen. Avoid dark reds, heavy blacks, and bright yellows.",
            },
            {
                "type": "orientation",
                "severity": "immediate",
                "title": "Head Sleeping Position",
                "description": "Always sleep with the head positioned toward the South or East to align with the Earth's magnetic dipole.",
            },
            {
                "type": "object",
                "severity": "recommended",
                "title": "Brass Bowl of Water with Fresh Flowers",
                "description": "Keep a small brass or bronze vessel filled with fresh water and floral petals in the NE corner of the room, refreshed daily.",
            },
            {
                "type": "structural",
                "severity": "optional",
                "title": "Room Reallocation",
                "description": "If layout permits, convert this room into a study, meditation space, or children's study, moving the master suite to SW or S.",
            },
        ],
        "SE": [
            {
                "type": "color",
                "severity": "immediate",
                "title": "Cooling Pastels",
                "description": "Use soothing shades of pastel green or cream. Avoid fiery tones like maroon, dark orange, and deep red.",
            },
            {
                "type": "object",
                "severity": "recommended",
                "title": "Rose Quartz Crystals",
                "description": "Place a pair of polished Rose Quartz spheres or lotus crystals on the bedside tables to cool temperamental friction.",
            },
        ],
        "NW": [
            {
                "type": "object",
                "severity": "recommended",
                "title": "Earth Grounding Stones",
                "description": "Place heavy natural river stones or an agate geode in the room corner to provide grounding weight against wind-induced restlessness.",
            },
        ],
    },
    "Toilet": {
        "NE": [
            {
                "type": "object",
                "severity": "immediate",
                "title": "Marine Rock Salt Neutralizer",
                "description": "Keep a glass or ceramic bowl filled with raw sea rock salt in the toilet. Replace weekly to absorb stagnant negative emanations.",
            },
            {
                "type": "object",
                "severity": "immediate",
                "title": "Zinc Energy Strips & Mirrors",
                "description": "Fix a Zinc Vastu strip or pyramid outside the toilet door frame. Place a convex mirror on the outer door panel to deflect energy back.",
            },
            {
                "type": "habits",
                "severity": "immediate",
                "title": "Operational Protocol",
                "description": "Keep the toilet door strictly closed at all times. Keep toilet seat lid down when not in use.",
            },
            {
                "type": "fragrance",
                "severity": "recommended",
                "title": "Camphor & Essential Diffuser",
                "description": "Burn pure natural camphor or diffuse lemongrass essential oil daily to purify the subtle atmospheric vibration.",
            },
        ],
        "SW": [
            {
                "type": "object",
                "severity": "immediate",
                "title": "Lead Helixes & Brass Strips",
                "description": "Install Lead Helixes and brass strips around the toilet perimeter to seal draining earth energy.",
            },
            {
                "type": "color",
                "severity": "recommended",
                "title": "Earthy Tiles",
                "description": "Use mustard yellow or earthy tile accents inside the space.",
            },
        ],
        "SE": [
            {
                "type": "object",
                "severity": "recommended",
                "title": "Copper Vastu Rods",
                "description": "Embed copper rods in the doorway threshold to contain fire disruption.",
            },
        ],
    },
    "Main Door": {
        "SW": [
            {
                "type": "object",
                "severity": "immediate",
                "title": "Lead Pyramid & Yellow Marble Threshold",
                "description": "Install a raised yellow marble threshold (Dehli) and embed three Lead Pyramids at the entry base to block heavy negative inflows.",
            },
            {
                "type": "symbol",
                "severity": "immediate",
                "title": "Panchmukhi Hanuman & Trishul Swastika",
                "description": "Mount a bronze Panchmukhi Hanuman ji plaque facing outward above the door lintel, flanked by sacred Swastika-Om symbols.",
            },
            {
                "type": "color",
                "severity": "recommended",
                "title": "Earth Tone Treatment",
                "description": "Paint or polish the door in warm teak, golden oak, or muted earth colors. Avoid black, dark gray, or bright blue.",
            },
        ],
        "SE": [
            {
                "type": "object",
                "severity": "immediate",
                "title": "Copper Gayatri Yantra",
                "description": "Fix a blessed Copper Gayatri Yantra on the outer upper frame to transmute volatile fire energy into protective light.",
            },
            {
                "type": "symbol",
                "severity": "recommended",
                "title": "Red Coral / Carnelian Touch",
                "description": "Hang a string of nine sacred red bells or carnelian crystals by the doorway.",
            },
        ],
    },
    "Staircase": {
        "NE": [
            {
                "type": "object",
                "severity": "immediate",
                "title": "Zinc Pyramids Under Riser",
                "description": "Conceal 9 energised Zinc Vastu Pyramids beneath the lower steps to energetically lighten the overhead burden in Ishaan.",
            },
            {
                "type": "lighting",
                "severity": "recommended",
                "title": "Bright White Illumination",
                "description": "Install continuous bright warm-white LED illumination along the staircase to banish shadows and stagnation.",
            },
            {
                "type": "color",
                "severity": "recommended",
                "title": "Light Airy Tones",
                "description": "Paint stair walls in brilliant off-white or light pearl. Keep under-stair storage completely clean and clutter-free.",
            },
        ],
        "Center": [
            {
                "type": "object",
                "severity": "immediate",
                "title": "Crystal Spheres in Brahmasthan",
                "description": "Hang a multi-faceted 50mm faceted crystal globe at the ceiling level near the central stairs to disperse oppressive pressure.",
            },
        ],
    },
    "Mandir": {
        "S": [
            {
                "type": "orientation",
                "severity": "immediate",
                "title": "Devotional Orientation",
                "description": "Ensure the worshipper faces North or East during prayers, even if the altar is placed against a southern wall.",
            },
            {
                "type": "color",
                "severity": "recommended",
                "title": "White & Saffron Sanctum",
                "description": "Line the sanctum interior with pure white Makrana marble or sandalwood accents.",
            },
        ],
        "SW": [
            {
                "type": "object",
                "severity": "immediate",
                "title": "Brass Diya & Peedhi Elevation",
                "description": "Elevate idols on a solid teakwood or marble peedhi above waist height and burn pure cow ghee lamp continuously during morning rituals.",
            },
        ],
    },
}

COMPLIANCE_TIERS: Dict[str, Dict[str, str]] = {
    "excellent": {
        "range": "80% - 100%",
        "rating": "Excellent (Maha-Vastu Aligned)",
        "summary": "Your home possesses outstanding energetic alignment. Major elemental zones (Agni, Ishanya, Nairutya) resonate in great harmony, promoting sustained health, wealth, and tranquil domestic well-being.",
        "general_advice": "Maintain the cleanliness of North-East and stability of South-West to sustain this auspicious vibrational flow.",
    },
    "good": {
        "range": "60% - 79%",
        "rating": "Good (Harmonious with Minor Distortions)",
        "summary": "Your layout is largely aligned with Vastu Shastra principles. A few rooms sit in suboptimal quadrants, but no catastrophic structural obstacles dominate.",
        "general_advice": "Implementing targeted non-structural remedies for neutral and negative sectors will elevate your home's total energetic quotient effortlessly.",
    },
    "moderate": {
        "range": "40% - 59%",
        "rating": "Moderate (Imbalanced Energy Flow)",
        "summary": "Noticeable elemental conflicts exist across core functional zones. Certain key rooms (such as kitchen, bedroom, or toilet) disrupt natural solar and magnetic vectors.",
        "general_advice": "Prioritize correcting the highest negative-impact rooms through color harmonization, elemental metal placement, and functional room swaps where feasible.",
    },
    "critical": {
        "range": "0% - 39%",
        "rating": "Critical (Major Elemental Conflict)",
        "summary": "Multiple primary rooms occupy hostile sectors (such as Ishaan dosha or Nairutya exposure). This configuration can induce chronic fatigue, financial leaks, and domestic stress if left unaddressed.",
        "general_advice": "Immediate remedial interventions and thoughtful layout restructuring (such as room swaps recommended by the optimizer) are strongly advised.",
    },
}


def get_compliance_tier(percent: float) -> Dict[str, str]:
    """Return the interpretation tier for a given compliance score percentage."""
    if percent >= 80.0:
        return COMPLIANCE_TIERS["excellent"]
    if percent >= 60.0:
        return COMPLIANCE_TIERS["good"]
    if percent >= 40.0:
        return COMPLIANCE_TIERS["moderate"]
    return COMPLIANCE_TIERS["critical"]


def get_room_remedies(room_type: str, direction: str) -> List[Dict[str, str]]:
    """Retrieve specific remedies for a room placed in a specific quadrant."""
    room_remedies = REMEDIES.get(room_type, {})
    if direction in room_remedies:
        return room_remedies[direction]

    # Fallback to general remedy if unfavourable
    return [
        {
            "type": "color",
            "severity": "recommended",
            "title": "Color Neutralization",
            "description": f"Use soft neutral tones (cream, light beige) for {room_type} to calm elemental friction.",
        },
        {
            "type": "plant",
            "severity": "optional",
            "title": "Natural Energy Harmonizer",
            "description": "Place healthy green indoor plants to naturally filter and elevate subtle room prana.",
        },
    ]


def get_relevant_knowledge(
    rows: List[Dict[str, Any]],
    compliance_percent: float,
    optimization: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Deterministically retrieve relevant Vastu knowledge chunks for the given analysis.

    Args:
        rows: Scored room rows from analysis (each having room_type, actual_zone, score, status, etc.)
        compliance_percent: The overall computed Vastu score percentage
        optimization: Optional optimization recommendation dict

    Returns:
        Structured context dictionary containing only the relevant chunks for this layout.
    """
    unfavourable_rooms: List[Dict[str, Any]] = []
    auspicious_rooms: List[Dict[str, Any]] = []
    moderate_rooms: List[Dict[str, Any]] = []

    for row in rows:
        room_type = row.get("room_type", "Generic Room")
        direction = row.get("actual_zone", "Center")
        score = float(row.get("score", 0.0))
        max_score = float(row.get("max_score", 1.0))
        status = row.get("status", "unfavourable" if score < 0 else "neutral")

        # Knowledge lookup
        knowledge_entry = VASTU_KNOWLEDGE.get(room_type, {}).get(direction, {})
        remedies_list = []

        if score <= 0 or status in ("unfavourable", "critical", "poor"):
            remedies_list = get_room_remedies(room_type, direction)

        entry_summary = {
            "room_id": row.get("room_id"),
            "room_type": room_type,
            "direction": direction,
            "score": score,
            "max_score": max_score,
            "status": status,
            "ideal_zone": row.get("ideal_zone", "Unknown"),
            "significance": knowledge_entry.get(
                "significance",
                f"{room_type} placed in {direction} produces a calculated score of {score}/{max_score}.",
            ),
            "elemental_harmony": knowledge_entry.get(
                "elemental_harmony",
                f"Interaction of {room_type} with {direction} sector energy.",
            ),
            "impact": knowledge_entry.get("impact", "General influence on household routine."),
            "remedies": remedies_list,
        }

        if score <= 0 or status in ("unfavourable", "critical"):
            unfavourable_rooms.append(entry_summary)
        elif score >= max_score * 0.7 and score > 0:
            auspicious_rooms.append(entry_summary)
        else:
            moderate_rooms.append(entry_summary)

    # Sort unfavourable rooms by highest negative impact (most negative first)
    unfavourable_rooms.sort(key=lambda item: item["score"])
    auspicious_rooms.sort(key=lambda item: item["score"], reverse=True)

    tier_info = get_compliance_tier(compliance_percent)

    optimization_context = None
    if optimization and optimization.get("move") and optimization.get("improvement", 0) > 0:
        optimization_context = {
            "move": optimization["move"],
            "original_score": optimization.get("original_score"),
            "optimized_score": optimization.get("optimized_score"),
            "improvement": optimization.get("improvement"),
        }

    return {
        "compliance_percent": compliance_percent,
        "tier": tier_info,
        "total_rooms_count": len(rows),
        "unfavourable_rooms": unfavourable_rooms,
        "auspicious_rooms": auspicious_rooms,
        "moderate_rooms": moderate_rooms,
        "optimization": optimization_context,
        "direction_meanings": {
            d: DIRECTION_SIGNIFICANCE[d] for d in DIRECTION_SIGNIFICANCE if d in {r.get("actual_zone") for r in rows}
        },
    }
