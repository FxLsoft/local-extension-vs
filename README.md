国际化辅助工具插件

Usage: vsce <command>

Options:
  -V, --version                      output the version number
  -h, --help                         display help for command

Commands:
  ls [options]                       Lists all the files that will be published
  package [options] [version]        Packages an extension
  publish [options] [version]        Publishes an extension
  unpublish [options] [extensionid]  Unpublishes an extension. Example extension id: microsoft.csharp.        
  ls-publishers                      List all known publishers
  delete-publisher <publisher>       Deletes a publisher
  login <publisher>                  Add a publisher to the known publishers list
  logout <publisher>                 Remove a publisher from the known publishers list
  verify-pat [options] [publisher]   Verify if the Personal Access Token has publish rights for the publisher.
  show [options] <extensionid>       Show extension metadata
  search [options] <text>            search extension gallery
  help [command]                     display help for command