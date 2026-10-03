VASTU_RULES = {
    "Kitchen": {"max": 12, "scores": {"SE": 12, "S": 7, "E": 7, "NE": -9}, "def": 0},
    "Main Door": {"max": 10, "scores": {"NE": 10, "N": 10, "E": 10, "SW": -7}, "def": 0},
    "Foyer": {"max": 10, "scores": {"NE": 10, "N": 10, "E": 10, "SW": -7}, "def": 0},
    "Master Bedroom": {"max": 10, "scores": {"SW": 10, "S": 6, "W": 6, "NE": -8}, "def": 0},
    "Toilet": {"max": 10, "scores": {"NW": 10, "W": 10, "S": 6, "NE": -10}, "def": 0},
    "Mandir": {"max": 13, "scores": {"NE": 13, "E": 8, "N": 8, "S": -8}, "def": 0},
    "Staircase": {"max": 7, "scores": {"SW": 7, "S": 7, "W": 7, "NE": -7}, "def": 0},
    "Living": {"max": 3, "scores": {"N": 3, "E": 3, "NE": 3, "SW": -3}, "def": 0},
    "Dining": {"max": 3, "scores": {"W": 3, "N": 3, "E": 2, "SW": -3}, "def": 0},
    "Kids Bedroom": {"max": 5, "scores": {"NW": 5, "NE": 5, "E": 5, "SW": -5}, "def": 0},
    "Guest": {"max": 5, "scores": {"NW": 5, "NE": 5, "E": 5, "SW": -5}, "def": 0},
    "Elders Bedroom": {"max": 5, "scores": {"SW": 5, "S": 5, "W": 3, "SE": -5}, "def": 0},
    "Wash": {"max": 5, "scores": {"SE": 5, "NW": 5, "E": 3, "NE": -5}, "def": 0},
    "Balcony": {"max": 4, "scores": {"N": 4, "E": 4, "NE": 4, "SW": -4}, "def": 0},
    "Generic Room": {"max": 0, "scores": {}, "def": 0},
}

ROOM_ALIASES = {
    "Mandir": ['mandir', 'pooja', 'puja', 'god', 'prayer', 'dev', 'sacred', 'temple', 'shrine', 'worship'],
    "Kitchen": ['kitchen', 'cook', 'rasoi', 'pantry', 'stove', 'fire', 'cooking', 'modular kitchen', 'dry kitchen', 'wet kitchen', 'kitchenette'],
    "Main Door": ['main door', 'main entrance', 'entrance', 'entry', 'gate', 'main gate', 'front door'],
    "Foyer": ['foyer', 'lobby', 'reception', 'passage', 'corridor', 'hallway'],
    "Master Bedroom": ['master bedroom', 'master bed', 'master', 'owner', 'couple', 'master suite', 'mbr'],
    "Kids Bedroom": ['kids bedroom', 'kid bedroom', 'child bedroom', 'children bedroom', 'boy bedroom', 'girl bedroom', 'study room', 'kids room', 'child room', 'study', 'nursery'],
    "Guest": ['guest bedroom', 'guest room', 'guest', 'spare room', 'spare bedroom'],
    "Elders Bedroom": ['elders bedroom', 'parents bedroom', 'parent bedroom', 'grandparent bedroom', 'elder room', 'bedroom', 'bed room', 'bed', 'room'],
    "Toilet": ['toilet', 'bathroom', 'bath', 'wc', 'washroom', 'restroom', 'powder room', 'powder', 'lavatory', 'latrine', 'common toilet', 'attached toilet', 'common bath', 'attached bath'],
    "Staircase": ['staircase', 'stair', 'stairs', 'lift', 'elevator', 'steps'],
    "Living": ['living room', 'living', 'hall', 'drawing room', 'drawing', 'lounge', 'sitting room', 'sitting', 'family room', 'family', 'office', 'home office', 'tv room'],
    "Dining": ['dining room', 'dining', 'eat', 'breakfast area', 'breakfast', 'eating', 'dinning', 'dining hall'],
    "Wash": ['wash room', 'wash area', 'utility', 'laundry', 'wash', 'utility room', 'service', 'service area', 'dry area', 'drying'],
    "Balcony": ['balcony', 'sitout', 'deck', 'terrace', 'varandha', 'verandah', 'veranda', 'patio', 'porch', 'sit out', 'open terrace', 'covered balcony'],
    "Generic Room": []
}

# Labels to ignore — these are not rooms
IGNORE_LABELS = {
    'up', 'dn', 'down', 'north', 'south', 'east', 'west',
    'lawn', 'garden', 'parking', 'car parking', 'car park',
    'w parking', 'two wheeler', 'bike', 'cycle',
    'ro', 'ro water', 'water', 'tank', 'water tank', 'overhead tank',
    'sump', 'ramp', 'drain', 'pipe', 'duct', 'shaft',
    'ac', 'ac unit', 'ac outdoor', 'outdoor unit',
    'compound', 'compound wall', 'boundary', 'boundary wall',
    'setback', 'road', 'street', 'plot', 'site',
    'floor plan', 'plan', 'section', 'elevation', 'detail',
    'scale', 'date', 'client', 'architect', 'drawing no',
    'ground floor', 'first floor', 'second floor', 'third floor',
    'gf', 'ff', 'sf', 'tf', 'basement',
    'all dimensions are in feet and inches',
    'dimensions', 'note', 'notes', 'legend', 'schedule',
    'a', 'b', 'c', 'd',  # single-letter artifacts from MTEXT formatting
}

CORE_DIRECTIONS = {
    "E": 0, "NE": 45, "N": 90, "NW": 135,
    "W": 180, "SW": 225, "S": 270, "SE": 315
}
