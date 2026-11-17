from collections import defaultdict


def compute_attendance_summary(attendance_records):
    summary = defaultdict(lambda: {"present": 0, "total": 0})

    for record in attendance_records:
        key = record["subject_id"]
        summary[key]["total"] += 1
        if record["status"] in {"present", "late"}:
            summary[key]["present"] += 1

    result = []
    for subject_id, stats in summary.items():
        if stats["total"] == 0:
            percent = 0
        else:
            percent = round((stats["present"] / stats["total"]) * 100, 2)
        result.append({
            "subject_id": subject_id,
            "percentage": percent,
            "present": stats["present"],
            "total": stats["total"],
        })

    return result


def attendance_threshold_projection(attendance_records, threshold=75):
    total = len(attendance_records)
    present = sum(1 for item in attendance_records if item["status"] in {"present", "late"})

    if total == 0:
        current = 0
    else:
        current = (present / total) * 100

    needed_classes = max(0, int((threshold * total) - (present * 100)) if total else 0)
    max_miss = max(0, int((total * threshold / 100)))

    return {
        "current_percentage": round(current, 2),
        "threshold": threshold,
        "needed_classes": needed_classes,
        "max_miss_allowed": max_miss,
        "warning": "At risk" if current < threshold else "On track",
    }


def extract_notice_keywords(content):
    keywords = {
        "dates": [],
        "deadlines": [],
    }

    lines = content.split()
    for word in lines:
        if any(ch.isdigit() for ch in word):
            keywords["dates"].append(word)

    if "deadline" in content.lower() or "submit" in content.lower():
        keywords["deadlines"].append("Action required")

    return keywords
