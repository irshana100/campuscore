FACULTY_ASSIGNMENT_RULES = {
    "roll_number_subject": {
        "subject_code": "BCS501",
        "min_roll": 1,
        "max_roll": 60,
        "bands": [
            {"start": 1, "end": 30, "teacher_name": "Prof. Kadeejath Ramzeela", "short_name": "KR"},
            {"start": 31, "end": 60, "teacher_name": "Prof. Zulema", "short_name": "ZUL"},
        ],
    }
}


def numeric_roll_number(roll_number):
    if not roll_number:
        return None
    import re
    matches = re.findall(r"\d+", str(roll_number))
    if not matches:
        return None
    final_number = int(matches[-1])
    if final_number <= 60:
        return final_number
    if final_number % 1000 <= 60:
        return final_number % 1000
    if final_number % 100 <= 60:
        return final_number % 100
    return None


def assigned_roll_number_faculty(roll_number, subject_code=None):
    rule = FACULTY_ASSIGNMENT_RULES["roll_number_subject"]
    if subject_code and subject_code != rule["subject_code"]:
        return None

    number = numeric_roll_number(roll_number)
    if number is None:
        return None
    for band in rule["bands"]:
        if band["start"] <= number <= band["end"]:
            return band.copy()
    return None
