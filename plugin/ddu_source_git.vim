scriptencoding utf-8
if exists('g:loaded_ddu_source_git') && g:loaded_ddu_source_git
  finish
endif
let g:loaded_ddu_source_git = 1

function s:initialize() abort
 highlight! default link DduSourceGitWorkingTreeUntracked Comment
 highlight! default link DduSourceGitWorkingTreeAdded DiffAdd
 highlight! default link DduSourceGitWorkingTreeDeleted DiffDelete
 highlight! default link DduSourceGitWorkingTreeChanged DiffChange

 highlight! DduSourceGitConflicted ctermfg=4 ctermbg=6 guifg=Red guibg=Yellow
 
 highlight! DduSourceGitIndexAdded ctermfg=2 guifg=Green
 highlight! DduSourceGitIndexDeleted ctermfg=4 guifg=Red
 highlight! DduSourceGitIndexChanged ctermfg=6 guifg=Yellow
endfunction


augroup InitializeDduSourceGit
  autocmd!
  autocmd User DenopsPluginPost:ddu call timer_start(0, { _ -> s:initialize() })
augroup END
