import type { Denops } from "https://deno.land/x/ddu_vim@v3.4.2/deps.ts";
import {
  ActionArguments,
  ActionFlags,
  BaseKind,
  Previewer,
} from "https://deno.land/x/ddu_vim@v3.4.3/types.ts";
import type { DduItem } from "https://deno.land/x/ddu_vim@v3.4.2/types.ts";
import { passthrough } from "../ddu-source-git_log/message.ts";
import { GetPreviewerArguments } from "https://deno.land/x/ddu_vim@v3.4.3/base/kind.ts";
import { ensure, is } from "https://deno.land/x/unknownutil@v3.2.0/mod.ts";
import {
  setreg,
} from "https://deno.land/x/denops_std@v5.0.1/function/mod.ts";
import { v } from "https://deno.land/x/denops_std@v5.0.1/variable/mod.ts";

export type ActionData = {
  cwd: string;
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

function callProcessByCommit(
  denops: Denops,
  item: DduItem,
  subargs: string[],
) {
  const action = item.action as ActionData;
  const args = [
    ...subargs,
    action.hash,
  ];
  passthrough(
    denops,
    new Deno.Command("git", {
      args,
      cwd: action.cwd,
      stdin: "null",
      stderr: "piped",
      stdout: "piped",
    }).spawn(),
  );
}

function getHash(actionParams: unknown, item?: DduItem) {
  const params = ensure(actionParams, is.Record);
  const length = ("length" in params) ? ensure(params.hard, is.Number) : 0;

  const action = item?.action as ActionData;
  return length > 0 ? action.hash.substring(0, length) : action.hash;
}
}

export class Kind extends BaseKind<Params> {
  actions: Record<
    string,
    (args: ActionArguments<Params>) => Promise<ActionFlags>
  > = {
    reset: async ({ actionParams, items, denops }) => {
      const item = await ensureOnlyOneItem(denops, items);
      if (!item) {
        return ActionFlags.None;
      }
      const params = ensure(actionParams, is.Record);
      const hard = ("hard" in params) && ensure(params.hard, is.Boolean);
      const gitArgs = ["reset"];
      if (hard) {
        gitArgs.push("--hard");
      }
      const hash = getHash(actionParams, item);
      gitArgs.push(hash);
      callProcessByCommit(denops, item, gitArgs);
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
  };

  getPreviewer(args: GetPreviewerArguments): Promise<Previewer | undefined> {
    const action = args.item.action as ActionData;
    return Promise.resolve({
      kind: "terminal",
      cmds: ["git", "show", action.hash],
    });
  }

  params(): Params {
    return {};
  }
}
