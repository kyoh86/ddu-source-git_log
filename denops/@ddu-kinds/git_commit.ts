import type { Denops } from "https://deno.land/x/ddu_vim@v3.4.4/deps.ts";
import {
  ActionFlags,
  BaseKind,
} from "https://deno.land/x/ddu_vim@v3.4.4/types.ts";
import type {
  Actions,
  Previewer,
} from "https://deno.land/x/ddu_vim@v3.4.4/types.ts";
import type { DduItem } from "https://deno.land/x/ddu_vim@v3.4.4/types.ts";
import { pipe } from "../ddu-source-git_log/message.ts";
import type { GetPreviewerArguments } from "https://deno.land/x/ddu_vim@v3.4.4/base/kind.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.4.0/mod.ts";
import {
  getreginfo,
  setreg,
} from "https://deno.land/x/denops_std@v5.0.1/function/mod.ts";
import { v } from "https://deno.land/x/denops_std@v5.0.1/variable/mod.ts";
import { batch } from "https://deno.land/x/denops_std@v5.0.1/batch/mod.ts";
import { fn } from "https://deno.land/x/ddu_vim@v3.4.4/deps.ts";

export type ActionData = {
  cwd: string;
  graph: string;
  hash: string;
  author: string;
  authDate: string;
  committer: string;
  commitDate: string;
  subject: string;
};

type Params = Record<never, never>;

async function ensureOnlyOneItem(denops: Denops, items: DduItem[]) {
  if (items.length != 1) {
    await denops.call(
      "ddu#util#print_error",
      "invalid action calling: it can accept only one item",
      "ddu-kind-git_commit",
    );
    return;
  }
  return items[0];
}

function getHash(actionParams: unknown, item?: DduItem) {
  const params = ensure(actionParams, is.Record);
  const length = ("length" in params) ? ensure(params.length, is.Number) : 0;

  const action = item?.action as ActionData;
  return length > 0 ? action.hash.substring(0, length) : action.hash;
}

async function put(denops: Denops, hash: string, after: boolean) {
  await batch(denops, async (denops) => {
    const oldReg = await getreginfo(denops, '"');

    await setreg(denops, '"', hash, "v");
    try {
      await denops.cmd(`normal! ""${after ? "p" : "P"}`);
    } finally {
      await setreg(denops, '"', oldReg);
    }
  });
}

export class Kind extends BaseKind<Params> {
  override actions: Actions<Params> = {
    reset: async ({ actionParams, items, denops }) => {
      const item = await ensureOnlyOneItem(denops, items);
      if (!item) {
        return ActionFlags.None;
      }
      const params = ensure(actionParams, is.Record);
      const hard = ("hard" in params) && ensure(params.hard, is.Boolean);
      const args = ["reset"];
      if (hard) {
        args.push("--hard");
      }
      const hash = getHash({}, item);
      args.push(hash);
      const { cwd } = item.action as ActionData;
      await pipe(denops, "git", { args, cwd });
      return ActionFlags.None;
    },

    createBranch: async ({ items, denops }) => {
      const item = await ensureOnlyOneItem(denops, items);
      if (!item) {
        return ActionFlags.None;
      }

      const name = await fn.input(denops, "New branch name:");
      const hash = getHash({}, item);
      const { cwd } = item.action as ActionData;
      await pipe(denops, "git", {
        args: ["checkout", "-b", name, hash],
        cwd,
      });
      return ActionFlags.None;
    },

    yank: async ({ actionParams, items, denops }) => {
      const item = await ensureOnlyOneItem(denops, items);
      if (!item) {
        return ActionFlags.None;
      }
      const hash = getHash(actionParams, item);

      await setreg(denops, '"', hash, "v");
      await setreg(denops, await v.get(denops, "register"), hash, "v");

      return ActionFlags.None;
    },

    insert: async ({ actionParams, items, denops }) => {
      const item = await ensureOnlyOneItem(denops, items);
      if (!item) {
        return ActionFlags.None;
      }
      const hash = getHash(actionParams, item);

      await put(denops, hash, false);

      return ActionFlags.None;
    },

    append: async ({ actionParams, items, denops }) => {
      const item = await ensureOnlyOneItem(denops, items);
      if (!item) {
        return ActionFlags.None;
      }
      const hash = getHash(actionParams, item);

      await put(denops, hash, true);

      return ActionFlags.None;
    },
  };

  getPreviewer(args: GetPreviewerArguments): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (typeof action.hash === "undefined") {
      return Promise.resolve({
        kind: "terminal",
        cmds: ["echo", "Select line is dummy of graph only."],
      });
    }
    return Promise.resolve({
      kind: "terminal",
      cmds: ["git", "show", action.hash],
    });
  }

  params(): Params {
    return {};
  }
}
