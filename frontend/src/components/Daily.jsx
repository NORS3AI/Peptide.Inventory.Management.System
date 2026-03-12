import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { CheckCircle2, Circle, Clock, AlertTriangle, Plus, X, Calendar, Trash2, FileText, Download } from 'lucide-react';
import Minutes from './Minutes';

export default function Daily() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [showMinutes, setShowMinutes] = useState(false);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'daily',
    priority: 'normal',
    expirationDate: ''
  });

  // Load tasks
  const loadTasks = async () => {
    try {
      const allTasks = await db.tasks.getAll();
      setTasks(allTasks);
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Create new task
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    try {
      await db.tasks.create({
        title: newTask.title,
        description: newTask.description,
        type: newTask.type,
        priority: newTask.priority,
        expirationDate: newTask.expirationDate || null
      });

      // Reset form
      setNewTask({
        title: '',
        description: '',
        type: 'daily',
        priority: 'normal',
        expirationDate: ''
      });
      setShowNewTask(false);
      await loadTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  // Update task
  const handleUpdateTask = async (id, updates) => {
    try {
      await db.tasks.update(id, updates);
      await loadTasks();
      setEditingTask(null);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Toggle completion
  const handleToggleComplete = async (task) => {
    try {
      if (task.completed) {
        await db.tasks.uncomplete(task.id);
      } else {
        await db.tasks.complete(task.id);
      }
      await loadTasks();
    } catch (error) {
      console.error('Error toggling task completion:', error);
    }
  };

  // Delete task
  const handleDeleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;

    try {
      await db.tasks.delete(id);
      await loadTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
    }
  };

  // Export tasks to text file for email
  const handleExportTasks = () => {
    const activeTasks = tasks.filter(t => !t.completed).sort((a, b) => {
      if (a.priority === 'critical' && b.priority !== 'critical') return -1;
      if (b.priority === 'critical' && a.priority !== 'critical') return 1;
      const aExp = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
      const bExp = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
      return aExp - bExp;
    });

    const completedTasks = tasks.filter(t => t.completed).sort((a, b) =>
      new Date(b.completedAt || 0) - new Date(a.completedAt || 0)
    );

    let output = 'DAILY TASKS REPORT\n';
    output += `Generated: ${new Date().toLocaleString()}\n`;
    output += `Total Tasks: ${tasks.length} (${activeTasks.length} active, ${completedTasks.length} completed)\n`;
    output += '='.repeat(80) + '\n\n';

    // Active Tasks
    if (activeTasks.length > 0) {
      output += 'ACTIVE TASKS\n';
      output += '-'.repeat(80) + '\n\n';

      activeTasks.forEach((task, index) => {
        output += `${index + 1}. ${task.title}\n`;
        output += `   Priority: ${task.priority.toUpperCase()} | Type: ${task.type}\n`;

        if (task.expirationDate) {
          const exp = new Date(task.expirationDate);
          const now = new Date();
          const diffMs = exp - now;
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);

          let timeInfo = '';
          if (diffMs < 0) timeInfo = '⚠️ OVERDUE';
          else if (diffHours < 1) timeInfo = '🔴 DUE NOW';
          else if (diffHours < 24) timeInfo = `🟠 ${diffHours}h remaining`;
          else timeInfo = `🟢 ${diffDays} days remaining`;

          output += `   Due: ${exp.toLocaleString()} ${timeInfo}\n`;
        }

        if (task.description) {
          output += `   Notes:\n`;
          const lines = task.description.split('\n');
          lines.forEach(line => {
            output += `     ${line}\n`;
          });
        }
        output += '\n';
      });
    } else {
      output += 'No active tasks.\n\n';
    }

    // Completed Tasks
    if (completedTasks.length > 0) {
      output += '\nCOMPLETED TASKS\n';
      output += '-'.repeat(80) + '\n\n';

      completedTasks.forEach((task, index) => {
        output += `${index + 1}. ✓ ${task.title}\n`;
        output += `   Completed: ${new Date(task.completedAt).toLocaleString()}\n\n`;
      });
    }

    // Download as .txt file
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `daily-tasks-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Get priority badge color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'normal': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Get time until expiration
  const getTimeUntilExpiration = (expirationDate) => {
    if (!expirationDate) return null;

    const now = new Date();
    const exp = new Date(expirationDate);
    const diffMs = exp - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMs < 0) return { text: 'Overdue', color: 'text-red-600 dark:text-red-400' };
    if (diffHours < 1) return { text: 'Due now', color: 'text-red-600 dark:text-red-400' };
    if (diffHours < 24) return { text: `${diffHours}h left`, color: 'text-orange-600 dark:text-orange-400' };
    if (diffDays === 1) return { text: '1 day left', color: 'text-yellow-600 dark:text-yellow-400' };
    if (diffDays < 7) return { text: `${diffDays} days left`, color: 'text-blue-600 dark:text-blue-400' };
    return { text: `${diffDays} days left`, color: 'text-gray-600 dark:text-gray-400' };
  };

  // Separate active and completed tasks
  const activeTasks = tasks.filter(t => !t.completed).sort((a, b) => {
    // Critical first
    if (a.priority === 'critical' && b.priority !== 'critical') return -1;
    if (b.priority === 'critical' && a.priority !== 'critical') return 1;

    // Then by expiration
    const aExp = a.expirationDate ? new Date(a.expirationDate).getTime() : Infinity;
    const bExp = b.expirationDate ? new Date(b.expirationDate).getTime() : Infinity;
    return aExp - bExp;
  });

  const completedTasks = tasks.filter(t => t.completed).sort((a, b) =>
    new Date(b.completedAt || 0) - new Date(a.completedAt || 0)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading tasks...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Daily Tasks</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage your daily and weekly tasks with expiration tracking
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportTasks}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowMinutes(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Team Minutes
          </button>
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* New Task Form */}
      {showNewTask && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New Task</h3>
            <button
              onClick={() => setShowNewTask(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Enter task title..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <span className={`text-xs ${
                  newTask.description.length > 9500
                    ? 'text-red-600 dark:text-red-400 font-semibold'
                    : newTask.description.length > 9000
                    ? 'text-orange-600 dark:text-orange-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {newTask.description.length} / 10,000
                </span>
              </div>
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Add detailed notes, checklists, or context..."
                rows={6}
                maxLength={10000}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={newTask.type}
                  onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Priority
                </label>
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Expiration Date
                </label>
                <input
                  type="datetime-local"
                  value={newTask.expirationDate}
                  onChange={(e) => setNewTask({ ...newTask, expirationDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowNewTask(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={!newTask.title.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Tasks */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <Circle className="w-5 h-5" />
          Active Tasks ({activeTasks.length})
        </h2>

        {activeTasks.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">No active tasks. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeTasks.map(task => {
              const timeInfo = getTimeUntilExpiration(task.expirationDate);
              const isEditing = editingTask?.id === task.id;

              return (
                <div
                  key={task.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleComplete(task)}
                      className="flex-shrink-0 mt-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <Circle className="w-5 h-5" />
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editingTask.title}
                            onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs ${
                                editingTask.description.length > 9500
                                  ? 'text-red-600 dark:text-red-400 font-semibold'
                                  : editingTask.description.length > 9000
                                  ? 'text-orange-600 dark:text-orange-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}>
                                {editingTask.description.length} / 10,000
                              </span>
                            </div>
                            <textarea
                              value={editingTask.description}
                              onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                              rows={4}
                              maxLength={10000}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleUpdateTask(task.id, editingTask)}
                              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTask(null)}
                              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h3
                              className="font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                              onClick={() => setEditingTask(task)}
                            >
                              {task.title}
                            </h3>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
                                {task.priority}
                              </span>
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                                {task.type}
                              </span>
                            </div>
                          </div>

                          {task.description && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap mb-2 font-mono">
                              {task.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            {timeInfo && (
                              <div className={`flex items-center gap-1 ${timeInfo.color}`}>
                                <Clock className="w-3 h-3" />
                                {timeInfo.text}
                              </div>
                            )}
                            {task.expirationDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {new Date(task.expirationDate).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Delete button */}
                    {!isEditing && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            Completed Tasks ({completedTasks.length})
          </h2>

          <div className="space-y-2">
            {completedTasks.map(task => (
              <div
                key={task.id}
                className="bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3 opacity-75"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleComplete(task)}
                    className="flex-shrink-0 mt-1 text-green-600 dark:text-green-400 hover:text-gray-400 transition-colors"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </button>

                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-500 dark:text-gray-400 line-through">
                      {task.title}
                    </h3>
                    {task.completedAt && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Completed {new Date(task.completedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="flex-shrink-0 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Minutes Modal */}
      {showMinutes && <Minutes onClose={() => setShowMinutes(false)} />}
    </div>
  );
}
