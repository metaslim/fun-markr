require 'json'

module Markr
  module Repository
    class AggregateRepository
      def initialize(db)
        @db = db
      end

      def save(test_id, stats)
        json_data = stats.to_json
        existing = @db[:test_aggregates].where(test_id: test_id).first

        if existing
          @db[:test_aggregates]
            .where(test_id: test_id)
            .update(data: json_data, updated_at: Time.now)
        else
          @db[:test_aggregates].insert(
            test_id: test_id,
            data: json_data,
            created_at: Time.now,
            updated_at: Time.now
          )
        end
      end

      def find_by_test_id(test_id)
        row = @db[:test_aggregates].where(test_id: test_id).first
        return nil unless row

        JSON.parse(row[:data])
      end

      def exists?(test_id)
        @db[:test_aggregates].where(test_id: test_id).count > 0
      end

      def list_all
        @db[:test_aggregates]
          .order(Sequel.desc(:updated_at))
          .map do |row|
            data = JSON.parse(row[:data])
            data['test_id'] = row[:test_id]
            data['updated_at'] = row[:updated_at]&.iso8601
            data
          end
      end
    end
  end
end
