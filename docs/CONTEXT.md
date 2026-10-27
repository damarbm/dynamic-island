# Dynamic Island

A GNOME Shell widget that sits at the center of the top bar and shows glanceable system information, expanding on demand.

## Language

**Island**:
The whole widget, in either its collapsed or expanded state.
_Avoid_: Notch, widget, bar

**Pill**:
The Island in its collapsed state: a compact shape showing the time and one Metric.
_Avoid_: Collapsed bar, badge

**Expanded View**:
The Island in its expanded state, showing all Metrics.
_Avoid_: Popup, dropdown, panel

**Metric**:
A single live system measurement shown by the Island: CPU usage, RAM usage, or network speed.
_Avoid_: Stat, widget, sensor

**Pill Metric**:
The one Metric the user has chosen to display in the Pill. Defaults to CPU.
_Avoid_: Primary stat, default metric

**History**:
The rolling record of recent Metric samples, kept in the background so the Expanded View's graphs are full the moment it opens.
_Avoid_: Log, trend data
