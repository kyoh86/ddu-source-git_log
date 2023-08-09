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
  kind: "commit";
  cwd: string;
  graph: string;
  hash: string;
  author: string;
  authDate: string;
  committer: string;
  commitDate: string;
  subject: string;
} | {
  kind: "graph";
  graph: string;
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

async function ensureOnlyOneCommitAction(denops: Denops, items: DduItem[]) {
  const item = await ensureOnlyOneItem(denops, items);
  if (!item) {
    return;
  }
  const action = item.action as ActionData;
  if (action.kind == "graph") {
    return;
  }
  return action;
}

function getHash(
  actionParams: unknown,
  actionData: ActionData & { kind: "commit" },
) {
  const params = ensure(actionParams, is.Record);
  const length = ("length" in params) ? ensure(params.length, is.Number) : 0;

  return length > 0 ? actionData.hash.substring(0, length) : actionData.hash;
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
      const action = await ensureOnlyOneCommitAction(denops, items);
      if (!action) {
        return ActionFlags.Persist;
      }
      const params = ensure(actionParams, is.Record);
      const hard = ("hard" in params) && ensure(params.hard, is.Boolean);
      const args = ["reset"];
      if (hard) {
        args.push("--hard");
      }
      const hash = getHash({}, action);
      args.push(hash);
      await pipe(denops, "git", { args, cwd: action.cwd });
      return ActionFlags.None;
    },

    createBranch: async ({ items, denops }) => {
      const action = await ensureOnlyOneCommitAction(denops, items);
      if (!action) {
        return ActionFlags.Persist;
      }
      const name = await fn.input(denops, "New branch name:");
      const hash = getHash({}, action);
      await pipe(denops, "git", {
        args: ["checkout", "-b", name, hash],
        cwd: action.cwd,
      });
      return ActionFlags.None;
    },

    cherryPick: async ({ items, denops }) => {
      const action = await ensureOnlyOneCommitAction(denops, items);
      if (!action) {
        return ActionFlags.Persist;
      }
      const hashes = items
        .map((item) => item.action as ActionData)
        .filter((action) => action.kind == "commit")
        .map((action) =>
          getHash({}, action as ActionData & { kind: "commit" })
        );
      await pipe(denops, "git", {
        args: ["cherry-pick", ...hashes],
        cwd: action.cwd,
      });
      return ActionFlags.None;
    },

    yank: async ({ actionParams, items, denops }) => {
      const action = await ensureOnlyOneCommitAction(denops, items);
      if (!action) {
        return ActionFlags.Persist;
      }
      const hash = getHash(actionParams, action);

      await setreg(denops, '"', hash, "v");
      await setreg(denops, await v.get(denops, "register"), hash, "v");

      return ActionFlags.None;
    },

    insert: async ({ actionParams, items, denops }) => {
      const action = await ensureOnlyOneCommitAction(denops, items);
      if (!action) {
        return ActionFlags.Persist;
      }
      const hash = getHash(actionParams, action);

      await put(denops, hash, false);

      return ActionFlags.None;
    },

    append: async ({ actionParams, items, denops }) => {
      const action = await ensureOnlyOneCommitAction(denops, items);
      if (!action) {
        return ActionFlags.Persist;
      }
      const hash = getHash(actionParams, action);

      await put(denops, hash, true);

      return ActionFlags.None;
    },
  };

  getPreviewer(args: GetPreviewerArguments): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (action.kind == "graph") {
      return Promise.resolve({
        kind: "nofile",
        contents: ["Selected line is graph only."],
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
