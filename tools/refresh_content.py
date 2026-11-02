#!/usr/bin/env python3
import argparse, concurrent.futures, os, sys, time
import refresh_public_data as rp

PY, NODE = sys.executable, "node"
WRITERS = ["build_demos.py", "refresh_videos.py"]
CHECKS = [("verify_highlights.js", [NODE, os.path.join(rp.HERE, "verify_highlights.js")]),
          ("verify_label_fit.js", [NODE, os.path.join(rp.HERE, "verify_label_fit.js")]),
          ("verify_i18n_coverage.js", [NODE, os.path.join(rp.HERE, "verify_i18n_coverage.js")]),
          ("linkgate.py --urls --scope highlights", [PY, os.path.join(rp.HERE, "linkgate.py"), "--urls", "--scope", "highlights"])]
STAMP = os.path.join(rp.HERE, ".content_refresh")


def hours_since(stamp=STAMP, now=None):
    try:
        with open(stamp) as f:
            done = float(f.read().split()[0])
    except (OSError, ValueError, IndexError):
        return None
    return ((time.time() if now is None else now) - done) / 3600


def fresh(age, hours):
    return age is not None and 0 <= age < hours


def record(stamp=STAMP, now=None):
    done = time.time() if now is None else now
    with open(stamp, "w") as f:
        f.write("%.0f %s\n" % (done, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(done))))


def main():
    ap = argparse.ArgumentParser(description="Content refresh: re-read what the board offers as highlights and check every "
                                             "tile against it. Product tours and tutorials come from the Databricks demo "
                                             "center and videos from the official Databricks YouTube channels; then every "
                                             "board and cloud is checked for highlight coverage, every language for label "
                                             "fit and translation coverage, and every highlight link for liveness. Run it "
                                             "after the platform refresh when you open a PR, and commit what it changes.")
    ap.add_argument("--check", action="store_true",
                    help="report drift without writing; exit 1 if any content is stale or any check fails")
    ap.add_argument("--if-older", type=float, metavar="HOURS",
                    help="skip the refresh when the last full one finished less than HOURS ago")
    args = ap.parse_args()
    age = hours_since()
    if args.if_older is not None and fresh(age, args.if_older):
        sys.stdout.write("the last content refresh finished %.0f hours ago, under %g; skipped\n" % (age, args.if_older))
        sys.exit(0)
    done = [rp.run(step, args.check) for step in WRITERS]
    with concurrent.futures.ThreadPoolExecutor(2) as ex:
        done += list(ex.map(lambda c: rp.run_cmd(*c), CHECKS))
    failed = rp.report(done)
    if not failed and not args.check:
        record()
    sys.stdout.write(("FAILED: " + ", ".join(failed)) if failed else "all content is current and every tile shows its highlights")
    sys.stdout.write("\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
