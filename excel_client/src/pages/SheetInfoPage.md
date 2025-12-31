Let create a SheetInfo Page.

When a user select view details on a file in the welcome screen, 
The user is taken to the SheetInfo page. 
The sheet_info page must read its file_id and sheet_idx from url parameters.
All navigation to the sheet_info page must make sure the file_id and sheet_idx are set. sheet_idx defaults to 0 if not known.

The Sheet Info Page has the following layout

------------------------------------------------------------------------------------
|Logo  Header                                                  user avatar         |
------------------------------------------------------------------------------------
| Excel tabs (radix ui tabs)           |                                           |
|                                      |                                           |
|                                      |              Chat Area                    |
|                                      |                                           |
|                                      |                                           |
|                                      |    If no messages add CTA with good icon  |
|                                      |                                           |
|                                      |                                           |
|                                      |                                           |
|                                      |                                           |
|           Sheet Data                 |                                           |
|         shown in html table          |                                           |
|         sticky header                |                                           |
|         sticky first column          |                                           |
|                                      |                                           |
|                                      |                                           |
|                                      |                                           |
|                                      |                                           |
|                                      |                                           |
|                                      |                                           |
|                         [Chat icon]  |                                           |
|                                      |                                           |
------------------------------------------------------------------------------------

Only the sheet data section must scroll in the left section.
The right section must scroll vertically and wrap the chat content in it.

When it makes sense, create components in their own files in the component folder and compose them into the page layout.

Implement SheetInfoPage.tsx and a route to it
Then update Welcome.tsx to have a view_details button that when clicked navigates to SheetInfoPage


Finally Lets add a floating ChatBubbleIcon to the bottom right of the left panel. The button will toggle the Right side Chat area. 

You must maintain the state of the chat area using a react state variable. 

Adding simple animation is a plus if the libraries support

