#!/usr/bin/env python3
import argparse, concurrent.futures, os, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
STEPS = ["scrape_regions.py", "scrape_stages.py", "build_certifications.py", "build_academy.py"]


def run_cmd(label, cmd):
    started = time.time()
    r = subprocess.run(cmd, capture_output=True, text=True)
    return label, r.returncode, (r.stdout + r.stderr).strip(), time.time() - started


def run(step, check):
    return run_cmd(step + (" --check" if check else ""),
                   [sys.executable, os.path.join(HERE, step)] + (["--check"] if check else []))


def report(done):
    failed = []
    for label, code, out, secs in done:
        sys.stdout.write(f"== {label} ({secs:.0f}s, exit {code})\n{out}\n\n")
        if code:
            failed.append(label)
    return failed


def main():
    ap = argparse.ArgumentParser(description="Platform refresh: re-read everything the board takes from public Databricks "
                                             "pages: regional availability, release stages and the Lakeflow Connect "
                                             "connector catalog, certifications, and Academy courses. Run it before the "
                                             "content refresh when you open a PR and commit what it changes.")
    ap.add_argument("--check", action="store_true",
                    help="report drift without writing; exit 1 if any data is stale or a description carries a release stage")
    args = ap.parse_args()
    with concurrent.futures.ThreadPoolExecutor(len(STEPS)) as ex:
        done = list(ex.map(lambda step: run(step, args.check), STEPS))
    failed = report(done)
    sys.stdout.write(("FAILED: " + ", ".join(failed)) if failed else "all public data is current")
    sys.stdout.write("\n")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
