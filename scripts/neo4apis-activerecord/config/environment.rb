#session = Neo4j::Session.open(:server_db, "http://localhost:7474")

config = YAML.load(File.read('config/database.yml'))['development']

ActiveRecord::Base.establish_connection(config)

class Event < ActiveRecord::Base
  self.primary_key = "rowid"
  #belongs_to :support_rep, foreign_key: 'SupportRepId', class_name: 'Employee'
end
