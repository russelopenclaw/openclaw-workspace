-- =====================================================
-- Task Workflow Triggers
-- Automated state transitions in Mission Control
-- =====================================================

-- Enable UUID extension for run IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Trigger: New Task Creation
-- Automatically sets initial state (BEFORE INSERT)
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_new_task_before()
RETURNS TRIGGER AS $$
BEGIN
  -- New tasks start in BACKLOG (or READY if priority=high)
  IF NEW.column_name IS NULL OR NEW.column_name = '' THEN
    IF NEW.priority = 'high' THEN
      NEW.column_name := 'READY';
    ELSE
      NEW.column_name := 'BACKLOG';
    END IF;
  END IF;
  
  -- Auto-generate task ID if not provided
  IF NEW.id IS NULL OR NEW.id = '' THEN
    NEW.id := 'T-' || COALESCE(
      (SELECT MAX(CAST(SUBSTRING(id FROM 3) AS INTEGER)) + 1 FROM tasks WHERE id ~ '^T-[0-9]+$'),
      101
    )::TEXT;
  END IF;
  
  -- Validate required fields
  IF NEW.deliverables IS NULL OR NEW.deliverables = '' THEN
    RAISE EXCEPTION 'DELIVERABLES_REQUIRED: Task must have deliverables specified. See tools/create-task.js';
  END IF;
  
  -- Set timestamps
  NEW.created_at := NOW();
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Trigger: Log Task Creation (AFTER INSERT)
-- Logs to history after task exists
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_new_task_after()
RETURNS TRIGGER AS $$
BEGIN
  -- Log creation to history
  INSERT INTO task_history (task_id, status, note)
  VALUES (NEW.id, 'created', 
    format('Task created: ID=%s, Title=%s, Column=%s, Agent=%s', 
      NEW.id::text, NEW.title, NEW.column_name, COALESCE(NEW.assignee, 'unassigned')));
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach BEFORE trigger
DROP TRIGGER IF EXISTS trg_new_task_before ON tasks;
CREATE TRIGGER trg_new_task_before
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_task_before();

-- Attach AFTER trigger
DROP TRIGGER IF EXISTS trg_new_task_after ON tasks;
CREATE TRIGGER trg_new_task_after
  AFTER INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_task_after();


-- =====================================================
-- Trigger: Task Status Change
-- Logs all column transitions
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_task_status_change()
RETURNS TRIGGER AS $$
DECLARE
  action_text TEXT;
BEGIN
  -- Only fire if column actually changed
  IF OLD.column_name IS DISTINCT FROM NEW.column_name THEN
    
    action_text := format('Transition: %s → %s', OLD.column_name, NEW.column_name);
    
    -- Auto-set timestamps based on new status
    IF NEW.column_name = 'IN_PROGRESS' AND OLD.started_at IS NULL THEN
      NEW.started_at := NOW();
    END IF;
    
    IF NEW.column_name = 'DONE' AND OLD.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    END IF;
    
    NEW.updated_at := NOW();
    
    -- Log transition to history
    INSERT INTO task_history (task_id, status, note)
    VALUES (
      NEW.id, 
      'status_change', 
      action_text
    );
    
    -- Emit notification (for webhook listeners)
    PERFORM pg_notify('task_status_changed', json_build_object(
      'task_id', NEW.id,
      'from', OLD.column_name,
      'to', NEW.column_name,
      'title', NEW.title,
      'assignee', NEW.assignee,
      'timestamp', NOW()
    )::text);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_status_change ON tasks;
CREATE TRIGGER trg_status_change
  AFTER UPDATE OF column_name ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_status_change();


-- =====================================================
-- Trigger: Auto-Archive Completed Tasks
-- After 7 days in DONE, archive
-- =====================================================
CREATE OR REPLACE FUNCTION trigger_auto_archive_done_tasks()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-set completed_at if not set
  IF NEW.column_name = 'DONE' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_archive ON tasks;
CREATE TRIGGER trg_auto_archive
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  WHEN (OLD.column_name = 'DONE' AND NEW.column_name = 'DONE')
  EXECUTE FUNCTION trigger_auto_archive_done_tasks();


-- =====================================================
-- Listen for status changes (for webhook daemon)
-- USAGE: LISTEN task_status_changed;
-- =====================================================

-- Test the trigger system
-- INSERT INTO tasks (title, deliverables, validation_criteria, assignee, priority)
-- VALUES ('Test task', 'Test output', ARRAY['test passes'], 'TestAgent', 'medium');
