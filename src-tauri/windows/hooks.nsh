!macro NSIS_HOOK_POSTINSTALL
  ; Never silently override an existing default .pdf ProgID if another application owned it
  ReadRegStr $R0 SHCTX "Software\Classes\.pdf" "AuraPDF.pdf_backup"
  ${If} $R0 != ""
  ${AndIf} $R0 != "AuraPDF.pdf"
    WriteRegStr SHCTX "Software\Classes\.pdf" "" "$R0"
  ${EndIf}

  ; Register AuraPDF in Windows "Open with" menu for .pdf files
  WriteRegStr SHCTX "Software\Classes\.pdf\OpenWithProgids" "AuraPDF.pdf" ""
  WriteRegStr SHCTX "Software\Classes\.pdf" "Content Type" "application/pdf"

  ; Ensure ProgID open command quotes both executable and file path
  WriteRegStr SHCTX "Software\Classes\AuraPDF.pdf" "" "PDF Document"
  WriteRegStr SHCTX "Software\Classes\AuraPDF.pdf" "FriendlyTypeName" "PDF Document"
  WriteRegStr SHCTX "Software\Classes\AuraPDF.pdf\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr SHCTX "Software\Classes\AuraPDF.pdf\shell\open" "" "Open with AuraPDF"
  WriteRegStr SHCTX "Software\Classes\AuraPDF.pdf\shell\open" "FriendlyAppName" "AuraPDF"
  WriteRegStr SHCTX "Software\Classes\AuraPDF.pdf\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""

  ; Register under Software\Classes\Applications for Open With & Explorer integration
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe" "FriendlyAppName" "AuraPDF"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\DefaultIcon" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\",0"
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\SupportedTypes" ".pdf" ""
  WriteRegStr SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""

  ; Register Capabilities & RegisteredApplications for Windows Default Apps settings
  WriteRegStr SHCTX "Software\aurapdf\AuraPDF\Capabilities" "ApplicationName" "AuraPDF"
  WriteRegStr SHCTX "Software\aurapdf\AuraPDF\Capabilities" "ApplicationDescription" "AuraPDF — Fast, Native Windows PDF Reader"
  WriteRegStr SHCTX "Software\aurapdf\AuraPDF\Capabilities\FileAssociations" ".pdf" "AuraPDF.pdf"
  WriteRegStr SHCTX "Software\RegisteredApplications" "AuraPDF" "Software\aurapdf\AuraPDF\Capabilities"

  !insertmacro UPDATEFILEASSOC
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DeleteRegValue SHCTX "Software\Classes\.pdf\OpenWithProgids" "AuraPDF.pdf"
  DeleteRegKey SHCTX "Software\Classes\Applications\${MAINBINARYNAME}.exe"
  DeleteRegKey SHCTX "Software\aurapdf\AuraPDF\Capabilities"
  DeleteRegValue SHCTX "Software\RegisteredApplications" "AuraPDF"
!macroend
