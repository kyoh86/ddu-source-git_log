import { test } from "https://deno.land/x/denops_test@v1.6.2/mod.ts";
import { assert } from "https://deno.land/std@0.216.0/assert/mod.ts";

test({
  mode: "all",
  name: "dummy",
  fn: () => {
    assert(true);
  },
});
