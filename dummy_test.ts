import { test } from "@denops/test";
import { assert } from "@std/assert";

test({
  mode: "all",
  name: "dummy",
  fn: () => {
    assert(true);
  },
});
