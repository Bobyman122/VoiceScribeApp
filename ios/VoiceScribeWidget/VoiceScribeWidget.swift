import WidgetKit
import SwiftUI

// MARK: - Data Model

struct WidgetSession: Codable, Identifiable {
  let id: String
  let createdAt: Double
  let durationSecs: Double
  let preview: String
  let summary: String
}

// MARK: - Timeline

struct SessionEntry: TimelineEntry {
  let date: Date
  let sessions: [WidgetSession]
}

// MARK: - Provider

private let appGroupID = "group.org.reactjs.native.example.VoiceScribeApp"

struct SessionProvider: TimelineProvider {
  func placeholder(in context: Context) -> SessionEntry {
    SessionEntry(date: Date(), sessions: [
      WidgetSession(id: "1", createdAt: Date().timeIntervalSince1970 * 1000 - 300_000, durationSecs: 125, preview: "Discussed the quarterly roadmap and upcoming sprint priorities with the team.", summary: "Q2 roadmap and sprint planning"),
      WidgetSession(id: "2", createdAt: Date().timeIntervalSince1970 * 1000 - 3_600_000, durationSecs: 60, preview: "Quick note about the project deadline being moved to next Friday.", summary: "Deadline moved to Friday"),
      WidgetSession(id: "3", createdAt: Date().timeIntervalSince1970 * 1000 - 86_400_000, durationSecs: 43, preview: "Grocery list: milk, eggs, bread, coffee, and some fruit.", summary: "Grocery list"),
    ])
  }

  func getSnapshot(in context: Context, completion: @escaping (SessionEntry) -> Void) {
    completion(SessionEntry(date: Date(), sessions: loadSessions()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SessionEntry>) -> Void) {
    let entry = SessionEntry(date: Date(), sessions: loadSessions())
    let next = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
    completion(Timeline(entries: [entry], policy: .after(next)))
  }

  private func loadSessions() -> [WidgetSession] {
    guard
      let defaults = UserDefaults(suiteName: appGroupID),
      let data = defaults.data(forKey: "widgetSessions"),
      let sessions = try? JSONDecoder().decode([WidgetSession].self, from: data)
    else { return [] }
    return sessions
  }
}

// MARK: - Named colors (resolve light/dark from Assets.xcassets automatically)

private let widgetBg        = Color("WidgetBg")
private let widgetTextBody  = Color("WidgetTextBody")
private let widgetTextMuted = Color("WidgetTextMuted")
private let widgetTextFaint = Color("WidgetTextFaint")
private let widgetDivider   = Color("WidgetDivider")
private let widgetEmptyIcon = Color("WidgetEmptyIcon")
private let widgetCoral     = Color("WidgetCoral")
private let widgetViolet    = Color("WidgetViolet")

// MARK: - Helpers

private func formatDuration(_ secs: Double) -> String {
  let s = Int(secs)
  return String(format: "%d:%02d", s / 60, s % 60)
}

private func timeAgo(_ ms: Double) -> String {
  let secs = (Date().timeIntervalSince1970 * 1000 - ms) / 1000
  if secs < 60 { return "just now" }
  if secs < 3600 { return "\(Int(secs / 60))m ago" }
  if secs < 86400 { return "\(Int(secs / 3600))h ago" }
  return "\(Int(secs / 86400))d ago"
}

// MARK: - Small Widget

struct SmallWidgetView: View {
  let sessions: [WidgetSession]

  var body: some View {
    ZStack(alignment: .bottomTrailing) {
      if let session = sessions.first {
        VStack(alignment: .leading, spacing: 6) {
          HStack(spacing: 6) {
            Image(systemName: "mic.fill")
              .font(.system(size: 11, weight: .semibold))
              .foregroundColor(widgetCoral)
            Text("Voice Scribe")
              .font(.system(size: 11, weight: .semibold))
              .foregroundColor(widgetCoral)
            Spacer()
            Text(timeAgo(session.createdAt))
              .font(.system(size: 9))
              .foregroundColor(widgetTextFaint)
          }

          Text(session.preview)
            .font(.system(size: 12))
            .foregroundColor(widgetTextBody)
            .lineLimit(4)
            .fixedSize(horizontal: false, vertical: false)

          Spacer(minLength: 0)

          HStack {
            Image(systemName: "waveform")
              .font(.system(size: 9))
              .foregroundColor(widgetViolet)
            Text(formatDuration(session.durationSecs))
              .font(.system(size: 10, weight: .medium))
              .foregroundColor(widgetViolet)
            Spacer()
          }
        }
        .padding(14)
      } else {
        EmptyStateView()
      }

      // Coral mic button — visual affordance; widgetURL fires on any tap
      ZStack {
        Circle()
          .fill(widgetCoral)
          .frame(width: 28, height: 28)
        Image(systemName: "mic.fill")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(.white)
      }
      .padding(10)
    }
    .widgetURL(URL(string: "voicescribe://record")!)
  }
}

// MARK: - Medium Widget

struct NewRecordingRowView: View {
  var body: some View {
    HStack(spacing: 10) {
      ZStack {
        Circle()
          .fill(widgetCoral.opacity(0.18))
          .frame(width: 30, height: 30)
        Image(systemName: "mic.fill")
          .font(.system(size: 12, weight: .semibold))
          .foregroundColor(widgetCoral)
      }
      Text("New Recording")
        .font(.system(size: 12, weight: .semibold))
        .foregroundColor(widgetCoral)
      Spacer()
      Image(systemName: "chevron.right")
        .font(.system(size: 11))
        .foregroundColor(widgetCoral.opacity(0.6))
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 8)
  }
}

struct SessionRowView: View {
  let session: WidgetSession

  var body: some View {
    HStack(spacing: 10) {
      VStack(alignment: .center, spacing: 2) {
        Image(systemName: "waveform")
          .font(.system(size: 10))
          .foregroundColor(widgetViolet)
        Text(formatDuration(session.durationSecs))
          .font(.system(size: 9, weight: .medium))
          .foregroundColor(widgetViolet)
      }
      .frame(width: 34)

      VStack(alignment: .leading, spacing: 2) {
        Text(session.preview)
          .font(.system(size: 11))
          .foregroundColor(widgetTextBody)
          .lineLimit(1)
        if !session.summary.isEmpty {
          Text(session.summary)
            .font(.system(size: 10))
            .foregroundColor(widgetTextMuted)
            .lineLimit(1)
        }
      }

      Spacer()

      Text(timeAgo(session.createdAt))
        .font(.system(size: 9))
        .foregroundColor(widgetTextFaint)
    }
    .padding(.horizontal, 14)
    .padding(.vertical, 7)
  }
}

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 6) {
      Image(systemName: "mic.slash")
        .font(.system(size: 22))
        .foregroundColor(widgetEmptyIcon)
      Text("No recordings yet")
        .font(.system(size: 11))
        .foregroundColor(widgetEmptyIcon)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

struct MediumWidgetView: View {
  let sessions: [WidgetSession]

  var body: some View {
    ZStack {
      VStack(alignment: .leading, spacing: 0) {
        HStack(spacing: 6) {
          Image(systemName: "mic.fill")
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(widgetCoral)
          Text("Voice Scribe")
            .font(.system(size: 12, weight: .bold))
            .foregroundColor(widgetCoral)
          Spacer()
          Text("\(sessions.count) recording\(sessions.count == 1 ? "" : "s")")
            .font(.system(size: 10))
            .foregroundColor(widgetTextFaint)
        }
        .padding(.horizontal, 14)
        .padding(.top, 12)
        .padding(.bottom, 8)

        Divider().background(widgetDivider)

        if sessions.isEmpty {
          EmptyStateView()
        } else {
          let visible = Array(sessions.prefix(2))
          ForEach(Array(visible.enumerated()), id: \.element.id) { _, session in
            SessionRowView(session: session)
            Divider().background(widgetDivider).padding(.leading, 14)
          }
        }

        Link(destination: URL(string: "voicescribe://record")!) {
          NewRecordingRowView()
        }

        Spacer(minLength: 0)
      }
    }
    .widgetURL(URL(string: "voicescribe://open")!)
  }
}

// MARK: - Widget Entry View

struct VoiceScribeWidgetEntryView: View {
  var entry: SessionEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    switch family {
    case .systemSmall:
      SmallWidgetView(sessions: entry.sessions)
    case .systemMedium:
      MediumWidgetView(sessions: entry.sessions)
    default:
      MediumWidgetView(sessions: entry.sessions)
    }
  }
}

// MARK: - Widget Definition

struct VoiceScribeWidget: Widget {
  let kind: String = "VoiceScribeWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: SessionProvider()) { entry in
      VoiceScribeWidgetEntryView(entry: entry)
        .containerBackground(for: .widget) { Color("WidgetBg") }
    }
    .configurationDisplayName("Voice Scribe")
    .description("Your recent voice recordings at a glance.")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

// MARK: - Preview

@available(iOS 17.0, *)
#Preview(as: .systemSmall) {
  VoiceScribeWidget()
} timeline: {
  SessionEntry(date: Date(), sessions: [
    WidgetSession(id: "1", createdAt: Date().timeIntervalSince1970 * 1000 - 300_000, durationSecs: 125, preview: "Discussed the quarterly roadmap and sprint priorities.", summary: "Q2 planning"),
  ])
}

@available(iOS 17.0, *)
#Preview(as: .systemMedium) {
  VoiceScribeWidget()
} timeline: {
  SessionEntry(date: Date(), sessions: [
    WidgetSession(id: "1", createdAt: Date().timeIntervalSince1970 * 1000 - 300_000, durationSecs: 125, preview: "Discussed the quarterly roadmap and sprint priorities.", summary: "Q2 planning"),
    WidgetSession(id: "2", createdAt: Date().timeIntervalSince1970 * 1000 - 3_600_000, durationSecs: 60, preview: "Deadline moved to next Friday per client request.", summary: "Deadline update"),
  ])
}
