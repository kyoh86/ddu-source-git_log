import { test } from "jsr:@denops/test@3.0.1";
import { assert } from "jsr:@std/assert@1.0.1";

test({
  mode: "all",
  name: "dummy",
  fn: () => {
    assert(true);
  },
});
