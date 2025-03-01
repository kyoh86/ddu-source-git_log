import {
  ActionFlags,
  type Actions,
  type DduItem,
  type Previewer,
} from "jsr:@shougo/ddu-vim@~10.1.0/types";
import {
  BaseKind,
  type GetPreviewerArguments,
} from "jsr:@shougo/ddu-vim@~10.1.0/kind";
import { echoallCommand } from "jsr:@kyoh86/denops-util@~0.1.0/command";
import { yank } from "jsr:@kyoh86/denops-util@~0.1.0/yank";
import { put } from "jsr:@kyoh86/denops-util@~0.1.0/put";
import { ensure, is } from "jsr:@core/unknownutil@~4.3.0";
import type { Denops } from "jsr:@denops/std@~7.5.0";
import * as fn from "jsr:@denops/std@~7.5.0/function";

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

type Params = Record<PropertyKey, never>;

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

export const GitLogActions: Actions<Params> = {
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
    await echoallCommand(denops, "git", { args, cwd: action.cwd });
    return ActionFlags.None;
  },

  createBranch: async ({ items, denops }) => {
    const action = await ensureOnlyOneCommitAction(denops, items);
    if (!action) {
      return ActionFlags.Persist;
    }
    const name = await fn.input(denops, "New branch name:");
    const hash = getHash({}, action);
    await echoallCommand(denops, "git", {
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
      .map((action) => getHash({}, action as ActionData & { kind: "commit" }));
    await echoallCommand(denops, "git", {
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
    await yank(denops, getHash(actionParams, action));
    return ActionFlags.None;
  },

  insert: async ({ actionParams, items, denops }) => {
    const action = await ensureOnlyOneCommitAction(denops, items);
    if (!action) {
      return ActionFlags.Persist;
    }
    await put(denops, getHash(actionParams, action), false);
    return ActionFlags.None;
  },

  append: async ({ actionParams, items, denops }) => {
    const action = await ensureOnlyOneCommitAction(denops, items);
    if (!action) {
      return ActionFlags.Persist;
    }
    await put(denops, getHash(actionParams, action), true);
    return ActionFlags.None;
  },
};

export class Kind extends BaseKind<Params> {
  actions = GitLogActions;
  override getPreviewer(
    args: GetPreviewerArguments,
  ): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    if (action.kind == "graph") {
      return Promise.resolve({
        kind: "nofile",
        contents: ["Selected line is graph only."],
      });
    }
    return Promise.resolve({
      kind: "terminal",
      cmds: ["git", "--no-pager", "-C", action.cwd, "show", action.hash],
    });
  }

  params(): Params {
    return {};
  }
}
