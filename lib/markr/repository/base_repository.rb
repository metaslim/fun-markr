module Markr
  module Repository
    class DatabaseError < StandardError; end

    class BaseRepository
      def initialize(db)
        @db = db
      end

      protected

      def with_error_handling
        yield
      rescue Sequel::DatabaseError => e
        raise DatabaseError, "Database error: #{e.message}"
      end
    end
  end
end
