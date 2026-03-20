#!/usr/bin/env ruby
require 'xcodeproj'

PROJECT_PATH = File.expand_path('VoiceScribeApp.xcodeproj', __dir__)
APP_GROUP    = 'group.org.reactjs.native.example.VoiceScribeApp'
WIDGET_BUNDLE_ID = 'org.reactjs.native.example.VoiceScribeApp.widget'
DEVELOPMENT_TEAM = 'DD4997U2D3'

project = Xcodeproj::Project.open(PROJECT_PATH)

# ── Guard: skip if already added ──────────────────────────────────────────────
if project.targets.any? { |t| t.name == 'VoiceScribeWidget' }
  puts 'Widget target already exists — nothing to do.'
  exit 0
end

main_target = project.targets.find { |t| t.name == 'VoiceScribeApp' }
raise 'Could not find VoiceScribeApp target' unless main_target

# ── 1. Create widget extension target ────────────────────────────────────────
widget_target = project.new_target(
  :app_extension,
  'VoiceScribeWidget',
  :ios,
  '16.0'
)

# ── 2. Create file group ──────────────────────────────────────────────────────
root_group    = project.main_group
widget_group  = root_group.new_group('VoiceScribeWidget', 'VoiceScribeWidget')

# Source files → compile phase
%w[VoiceScribeWidget.swift VoiceScribeWidgetBundle.swift].each do |name|
  ref = widget_group.new_file(name)
  widget_target.source_build_phase.add_file_reference(ref)
end

# Assets → resources phase
assets_ref = widget_group.new_file('Assets.xcassets')
widget_target.resources_build_phase.add_file_reference(assets_ref)

# Info.plist & entitlements – referenced via build settings only
widget_group.new_file('Info.plist')
widget_group.new_file('VoiceScribeWidget.entitlements')

# ── 3. Widget build settings ──────────────────────────────────────────────────
widget_target.build_configurations.each do |cfg|
  s = cfg.build_settings
  s['PRODUCT_NAME']                 = 'VoiceScribeWidget'
  s['PRODUCT_BUNDLE_IDENTIFIER']    = WIDGET_BUNDLE_ID
  s['INFOPLIST_FILE']               = 'VoiceScribeWidget/Info.plist'
  s['CODE_SIGN_ENTITLEMENTS']       = 'VoiceScribeWidget/VoiceScribeWidget.entitlements'
  s['SWIFT_VERSION']                = '5.0'
  s['TARGETED_DEVICE_FAMILY']       = '1,2'
  s['IPHONEOS_DEPLOYMENT_TARGET']   = '16.0'
  s['SKIP_INSTALL']                 = 'YES'
  s['DEVELOPMENT_TEAM']             = DEVELOPMENT_TEAM
  s['SWIFT_EMIT_LOC_STRINGS']       = 'YES'
  s['LD_RUNPATH_SEARCH_PATHS']      = ['$(inherited)', '@executable_path/../../Frameworks']
  if cfg.name == 'Debug'
    s['SWIFT_OPTIMIZATION_LEVEL']   = '-Onone'
    s['SWIFT_ACTIVE_COMPILATION_CONDITIONS'] = '$(inherited) DEBUG'
  end
end

# ── 4. Add WidgetDataModule to main app ───────────────────────────────────────
app_group = root_group['VoiceScribeApp']

swift_ref = app_group.new_file('WidgetDataModule.swift')
m_ref     = app_group.new_file('WidgetDataModule.m')

main_target.source_build_phase.add_file_reference(swift_ref)
main_target.source_build_phase.add_file_reference(m_ref)

# ── 5. Add entitlements to main app build settings ───────────────────────────
main_target.build_configurations.each do |cfg|
  cfg.build_settings['CODE_SIGN_ENTITLEMENTS'] =
    'VoiceScribeApp/VoiceScribeApp.entitlements'
end

# ── 6. Depend on + embed the widget extension ─────────────────────────────────
main_target.add_dependency(widget_target)

embed_phase = project.new(Xcodeproj::Project::Object::PBXCopyFilesBuildPhase)
embed_phase.name                   = 'Embed Foundation Extensions'
embed_phase.symbol_dst_subfolder_spec = :plug_ins
main_target.build_phases << embed_phase

embed_file = embed_phase.add_file_reference(widget_target.product_reference)
embed_file.settings = { 'ATTRIBUTES' => ['RemoveHeadersOnCopy'] }

# ── 7. Register widget product in Products group ──────────────────────────────
products_group = root_group['Products']
products_group << widget_target.product_reference

# ── 8. Save ───────────────────────────────────────────────────────────────────
project.save
puts 'Done! VoiceScribeWidget target added to VoiceScribeApp.xcodeproj'
