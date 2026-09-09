from finrobot_equity.research_desk.intelligence.calendar_values import actual_value


def test_ambiguous_zero_is_not_a_confirmed_release():
    assert actual_value(0, "2020-01-01T00:00:00+00:00") == (None, "unverified")
    assert actual_value("0.0", "2020-01-01T00:00:00+00:00", confirmed=True) == (0, "reported")
    assert actual_value(3.1, "2020-01-01T00:00:00+00:00") == (3.1, "reported")
    assert actual_value(None, "2020-01-01T00:00:00+00:00") == (None, "unavailable")
    assert actual_value(0, "2100-01-01T00:00:00+00:00") == (None, "scheduled")
