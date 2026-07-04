from mlxstudio.services.metrics import classify_fit

GB = 10**9


def test_classify_fit_unknown_without_estimate():
    assert classify_fit(None, 10 * GB, 40 * GB) == "unknown"


def test_classify_fit_within_budget():
    assert classify_fit(5 * GB, 10 * GB, 40 * GB) == "fits"


def test_classify_fit_tight_when_over_budget_but_under_total():
    assert classify_fit(20 * GB, 10 * GB, 40 * GB) == "tight"


def test_classify_fit_too_big_over_total():
    assert classify_fit(50 * GB, 10 * GB, 40 * GB) == "too_big"
